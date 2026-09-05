import re

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload, selectinload

from app.deps import get_db, require_admin
from app.engine.authoring import draft_problem_assets
from app.engine.grader import grade_submission
from app.engine.loader import problem_spec_from_orm
from app.engine.stub import build_starter_code, build_stub_module
from app.engine.types import Port, ProblemSpec, TestMeta
from app.errors import AppError, ConflictError, NotFoundError
from app.models.problem import Problem, ProblemAsset, ProblemKind, ProblemStatus, ProblemTest, ProblemValidation, Topic
from app.models.user import User
from app.pagination import Pagination, pagination
from app.schemas.admin import (
    AdminProblemOut,
    AiDraftOut,
    ProblemAssetsIn,
    ProblemCreate,
    ProblemUpdate,
    ValidationOut,
)
from app.schemas.page import Page

router = APIRouter(prefix="/api/admin/problems", tags=["admin"], dependencies=[Depends(require_admin)])

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(name: str) -> str:
    return _SLUG_RE.sub("_", name.strip().lower()).strip("_")


def _resolve_topics(db: Session, names: list[str]) -> list[Topic]:
    """Find-or-create by name — the admin wizard never needs a separate
    'manage topics' screen to assign a problem to a new study area."""
    resolved: list[Topic] = []
    for raw in names:
        name = raw.strip()
        if not name:
            continue
        slug = _slugify(name)
        topic = db.query(Topic).filter(Topic.slug == slug).first()
        if not topic:
            topic = Topic(slug=slug, name=name)
            db.add(topic)
            db.flush()
        resolved.append(topic)
    return resolved


def _get_or_404(db: Session, problem_id: str) -> Problem:
    # asset is one-to-one — joinedload is the right tool there (a single
    # extra JOIN, no row multiplication possible). tests and topics are
    # both one-to-many/many-to-many on the SAME parent row; joinedload-ing
    # two collections at once multiplies rows (tests × topics) before the
    # ORM dedupes them back down — selectinload issues one extra
    # `WHERE problem_id IN (...)` query per collection instead and never
    # multiplies anything.
    problem = (
        db.query(Problem)
        .options(joinedload(Problem.asset), selectinload(Problem.tests), selectinload(Problem.topics))
        .filter(Problem.id == problem_id)
        .first()
    )
    if not problem:
        raise NotFoundError("Problem not found.")
    return problem


@router.get("", response_model=Page[AdminProblemOut])
def list_all(page: Pagination = Depends(pagination), db: Session = Depends(get_db)) -> Page[AdminProblemOut]:
    query = db.query(Problem).options(selectinload(Problem.topics))
    total = query.count()
    problems = query.order_by(Problem.order_index).offset(page.offset).limit(page.limit).all()
    # Page[AdminProblemOut](...) — parameterized explicitly at
    # construction, not left bare. `problems` here is a list of raw ORM
    # objects, not AdminProblemOut instances yet; binding T at
    # construction time is what makes AdminProblemOut's own
    # from_attributes=True actually run per item. A bare Page(...) leaves
    # T unbound and pydantic has nothing telling it to convert each entry.
    return Page[AdminProblemOut](items=problems, total=total, limit=page.limit, offset=page.offset)


@router.post("", response_model=AdminProblemOut, status_code=201)
def create_problem(body: ProblemCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> Problem:
    if db.query(Problem).filter(Problem.slug == body.slug).first():
        raise ConflictError(f"A problem with slug '{body.slug}' already exists.")

    interface = {"module": body.slug, "ports": [p.model_dump() for p in body.ports]}
    constraints = {"banned_tasks": body.banned_tasks}
    if body.reset_sync is not None:
        constraints["reset"] = {"sync": body.reset_sync, "active_high": body.reset_active_high}

    ports = [Port(name=p.name, dir=p.dir, width=p.width) for p in body.ports]
    starter_code = body.starter_code or build_starter_code(_bare_spec(body.slug, body.kind, ports))

    problem = Problem(
        slug=body.slug,
        title=body.title,
        difficulty=body.difficulty,
        kind=ProblemKind(body.kind),
        statement_md=body.statement_md,
        starter_code=starter_code,
        interface=interface,
        constraints=constraints,
        rubric=body.rubric,
        sample_tests=body.sample_tests,
        status=ProblemStatus.draft,
        created_by=admin.id,
    )
    db.add(problem)
    db.flush()

    for i, t in enumerate(body.tests):
        db.add(
            ProblemTest(
                problem_id=problem.id, test_id=t.test_id, purpose=t.purpose,
                category=t.category, hint=t.hint, bucket=t.bucket, order_index=i,
            )
        )
    problem.topics = _resolve_topics(db, body.topics)
    db.commit()
    db.refresh(problem)
    return problem


def _bare_spec(module: str, kind: str, ports: list[Port]) -> ProblemSpec:
    """Just enough of a ProblemSpec for build_starter_code, which only reads .module/.ports."""
    return ProblemSpec(slug=module, module=module, kind=kind, ports=ports, banned_tasks=[], rubric={}, tests=[], testbench_sv="", reference_sv="")


@router.patch("/{problem_id}", response_model=AdminProblemOut)
def update_problem(problem_id: str, body: ProblemUpdate, db: Session = Depends(get_db)) -> Problem:
    problem = _get_or_404(db, problem_id)

    fields = body.model_dump(exclude_unset=True)
    if "ports" in fields:
        problem.interface = {**problem.interface, "ports": [p.model_dump() if hasattr(p, "model_dump") else p for p in fields.pop("ports")]}
    if "banned_tasks" in fields:
        problem.constraints = {**problem.constraints, "banned_tasks": fields.pop("banned_tasks")}
    if "tests" in fields:
        db.query(ProblemTest).filter(ProblemTest.problem_id == problem.id).delete()
        for i, t in enumerate(fields.pop("tests")):
            t = t if isinstance(t, dict) else t.model_dump()
            db.add(ProblemTest(problem_id=problem.id, order_index=i, **t))
    if "topics" in fields:
        problem.topics = _resolve_topics(db, fields.pop("topics"))
    for key, value in fields.items():
        setattr(problem, key, value)

    # Editing a published problem invalidates its prior validation —
    # design doc §7: "resets status to draft and requires re-validation."
    problem.status = ProblemStatus.draft
    db.commit()
    db.refresh(problem)
    return problem


@router.put("/{problem_id}/assets", response_model=AdminProblemOut)
def set_assets(problem_id: str, body: ProblemAssetsIn, db: Session = Depends(get_db)) -> Problem:
    problem = _get_or_404(db, problem_id)
    if problem.asset:
        problem.asset.testbench_sv = body.testbench_sv
        problem.asset.reference_sv = body.reference_sv
    else:
        db.add(ProblemAsset(problem_id=problem.id, testbench_sv=body.testbench_sv, reference_sv=body.reference_sv))
    problem.status = ProblemStatus.draft
    db.commit()
    db.refresh(problem)
    return problem


@router.post("/{problem_id}/ai-draft", response_model=AiDraftOut)
def ai_draft(problem_id: str, db: Session = Depends(get_db)) -> AiDraftOut:
    problem = _get_or_404(db, problem_id)
    if not problem.tests:
        raise AppError("Add at least one test before requesting an AI draft.", status_code=422)

    ports = [Port(**p) for p in problem.interface["ports"]]
    tests = [TestMeta(test_id=t.test_id, purpose=t.purpose, category=t.category, hint=t.hint, bucket=t.bucket) for t in problem.tests]

    try:
        draft = draft_problem_assets(problem.interface["module"], problem.kind.value, ports, tests, problem.constraints)
    except Exception as exc:  # noqa: BLE001 — surface as a normal error, not a 500 stack trace
        raise AppError(f"AI drafting failed: {exc}", status_code=502)

    return AiDraftOut(testbench_sv=draft.testbench_sv, reference_sv=draft.reference_sv)


@router.post("/{problem_id}/validate", response_model=ValidationOut)
def validate(problem_id: str, db: Session = Depends(get_db)) -> ValidationOut:
    problem = _get_or_404(db, problem_id)
    if not problem.asset:
        raise AppError("Add a testbench and reference solution before validating.", status_code=422)

    spec = problem_spec_from_orm(problem)
    log_lines: list[str] = []

    ref_result = grade_submission(spec, spec.reference_sv, with_feedback=False)
    ref_score = ref_result.score.total if ref_result.score else 0
    check1 = ref_result.verdict == "CORRECT" and ref_score == 100
    log_lines.append(f"[1] reference scores 100: {'OK' if check1 else 'FAIL'} (got {ref_score}, verdict {ref_result.verdict})")

    stub = build_stub_module(spec)
    stub_result = grade_submission(spec, stub, with_feedback=False)
    stub_score = stub_result.score.total if stub_result.score else 0
    check2 = stub_score < 100
    log_lines.append(f"[2] empty stub scores below 100: {'OK' if check2 else 'FAIL'} (got {stub_score})")

    declared_ids = {t.test_id for t in spec.tests}
    seen_ids = {o.id for o in ref_result.simulation.tests} if ref_result.simulation else set()
    check3 = declared_ids == seen_ids
    log_lines.append(f"[3] test ids reconcile: {'OK' if check3 else 'FAIL'} (declared {sorted(declared_ids)}, simulator {sorted(seen_ids)})")

    ok = check1 and check2 and check3
    db.add(ProblemValidation(problem_id=problem.id, ok=ok, ref_score=ref_score, stub_score=stub_score, log="\n".join(log_lines)))
    problem.status = ProblemStatus.validated if ok else ProblemStatus.draft
    db.commit()

    return ValidationOut(ok=ok, ref_score=ref_score, stub_score=stub_score, log="\n".join(log_lines))


@router.post("/{problem_id}/publish", response_model=AdminProblemOut)
def publish(problem_id: str, db: Session = Depends(get_db)) -> Problem:
    problem = _get_or_404(db, problem_id)
    if problem.status != ProblemStatus.validated:
        raise ConflictError("Problem must pass validation before it can be published.")
    problem.status = ProblemStatus.published
    db.commit()
    db.refresh(problem)
    return problem


@router.post("/{problem_id}/unpublish", response_model=AdminProblemOut)
def unpublish(problem_id: str, db: Session = Depends(get_db)) -> Problem:
    problem = _get_or_404(db, problem_id)
    problem.status = ProblemStatus.archived
    db.commit()
    db.refresh(problem)
    return problem
