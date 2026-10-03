import re

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.deps import get_db, require_admin
from app.engine.authoring import draft_problem_assets
from app.engine.loader import problem_spec_from_orm
from app.engine.stub import build_starter_code
from app.engine.validate import run_gate
from app.engine.types import Port, ProblemSpec, TestMeta
from app.errors import AppError, ConflictError, NotFoundError
from app.models.problem import Problem, ProblemAsset, ProblemKind, ProblemStatus, ProblemTest, ProblemValidation, Topic
from app.models.user import User
from app.pagination import Pagination, pagination
from app.schemas.admin import (
    AdminProblemDetail,
    AdminProblemOut,
    AdminSummary,
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
    """Find-or-create by name; the admin wizard never needs a separate
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
    # asset is one-to-one; joinedload is the right tool there (a single
    # extra JOIN, no row multiplication possible). tests and topics are
    # both one-to-many/many-to-many on the SAME parent row; joinedload-ing
    # two collections at once multiplies rows (tests × topics) before the
    # ORM dedupes them back down; selectinload issues one extra
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


@router.get("/summary", response_model=AdminSummary)
def summary(db: Session = Depends(get_db)) -> AdminSummary:
    """Counts per status, for the filter chips on the admin list."""
    rows = db.query(Problem.status, func.count(Problem.id)).group_by(Problem.status).all()
    by_status = {s.value: 0 for s in ProblemStatus}
    by_status.update({(st.value if hasattr(st, "value") else st): n for st, n in rows})
    return AdminSummary(total=sum(by_status.values()), by_status=by_status)


@router.get("", response_model=Page[AdminProblemOut])
def list_all(
    status: str | None = Query(None, pattern="^(draft|validated|published|archived)$"),
    page: Pagination = Depends(pagination),
    db: Session = Depends(get_db),
) -> Page[AdminProblemOut]:
    query = db.query(Problem).options(selectinload(Problem.topics))
    if status:
        query = query.filter(Problem.status == ProblemStatus(status))
    total = query.count()
    problems = query.order_by(Problem.number).offset(page.offset).limit(page.limit).all()
    # Page[AdminProblemOut](...); parameterized explicitly at
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
    number = body.number or (db.query(func.max(Problem.number)).scalar() or 0) + 1
    if db.query(Problem).filter(Problem.number == number).first():
        raise ConflictError(f"Problem number {number:04d} is already taken.")

    interface = {"module": body.slug, "ports": [p.model_dump() for p in body.ports]}
    constraints = {"banned_tasks": body.banned_tasks}
    if body.reset_sync is not None:
        constraints["reset"] = {"sync": body.reset_sync, "active_high": body.reset_active_high}

    ports = [Port(name=p.name, dir=p.dir, width=p.width) for p in body.ports]
    starter_code = body.starter_code or build_starter_code(_bare_spec(body.slug, body.kind, ports))

    problem = Problem(
        slug=body.slug,
        number=number,
        title=body.title,
        domain=body.domain,
        language=body.language,
        hints=body.hints,
        difficulty=body.difficulty,
        kind=ProblemKind(body.kind),
        statement_md=body.statement_md,
        starter_code=starter_code,
        interface=interface,
        constraints=constraints,
        rubric=body.rubric,
        sample_tests=[s.model_dump() for s in body.sample_tests],
        status=ProblemStatus.draft,
        order_index=number,
        created_by=admin.id,
    )
    db.add(problem)
    db.flush()

    for i, t in enumerate(body.tests):
        db.add(
            ProblemTest(
                problem_id=problem.id, test_id=t.test_id, purpose=t.purpose,
                category=t.category, hint=t.hint, bucket=t.bucket, visible=t.visible, order_index=i,
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
    if "number" in fields and fields["number"] != problem.number:
        if db.query(Problem).filter(Problem.number == fields["number"], Problem.id != problem.id).first():
            raise ConflictError(f"Problem number {fields['number']:04d} is already taken.")
        problem.order_index = fields["number"]
    if "topics" in fields:
        problem.topics = _resolve_topics(db, fields.pop("topics"))
    if "kind" in fields:
        problem.kind = ProblemKind(fields.pop("kind"))
    if "reset_sync" in fields or "reset_active_high" in fields:
        sync, high = fields.pop("reset_sync", None), fields.pop("reset_active_high", None)
        constraints = dict(problem.constraints or {})
        if sync is None and high is None:
            constraints.pop("reset", None)
        else:
            constraints["reset"] = {"sync": bool(sync), "active_high": high is not False}
        problem.constraints = constraints
    for key, value in fields.items():
        setattr(problem, key, value)

    # Editing a published problem invalidates its prior validation:
    # design doc §7: "resets status to draft and requires re-validation."
    problem.status = ProblemStatus.draft
    db.commit()
    db.refresh(problem)
    return problem


@router.get("/{problem_id}", response_model=AdminProblemDetail)
def get_one(problem_id: str, db: Session = Depends(get_db)) -> AdminProblemDetail:
    problem = _get_or_404(db, problem_id)
    last = (
        db.query(ProblemValidation)
        .filter(ProblemValidation.problem_id == problem.id)
        .order_by(ProblemValidation.ran_at.desc())
        .first()
    )
    return AdminProblemDetail(
        id=problem.id,
        slug=problem.slug,
        number=problem.number,
        title=problem.title,
        domain=problem.domain,
        language=problem.language,
        difficulty=problem.difficulty,
        kind=problem.kind.value,
        status=problem.status.value,
        order_index=problem.order_index,
        rubric=problem.rubric,
        topics=problem.topics,
        statement_md=problem.statement_md,
        starter_code=problem.starter_code,
        interface=problem.interface,
        constraints=problem.constraints or {},
        sample_tests=problem.sample_tests or [],
        hints=problem.hints or [],
        tests=[
            {"test_id": t.test_id, "purpose": t.purpose, "category": t.category, "hint": t.hint, "bucket": t.bucket, "visible": t.visible}
            for t in problem.tests
        ],
        testbench_sv=problem.asset.testbench_sv if problem.asset else "",
        reference_sv=problem.asset.reference_sv if problem.asset else "",
        last_validation=(
            {"ok": last.ok, "ref_score": last.ref_score, "stub_score": last.stub_score, "log": last.log or ""} if last else None
        ),
    )


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

    ports = [Port(name=p["name"], dir=p["dir"], width=p["width"]) for p in problem.interface["ports"]]
    tests = [
        TestMeta(test_id=t.test_id, purpose=t.purpose, category=t.category, hint=t.hint, bucket=t.bucket, visible=t.visible)
        for t in problem.tests
    ]

    try:
        draft = draft_problem_assets(problem.interface["module"], problem.kind.value, ports, tests, problem.constraints)
    except Exception as exc:  # noqa: BLE001; surface as a normal error, not a 500 stack trace
        raise AppError(f"AI drafting failed: {exc}", status_code=502)

    return AiDraftOut(testbench_sv=draft.testbench_sv, reference_sv=draft.reference_sv)


@router.post("/{problem_id}/validate", response_model=ValidationOut)
def validate(problem_id: str, db: Session = Depends(get_db)) -> ValidationOut:
    problem = _get_or_404(db, problem_id)
    if not problem.asset:
        raise AppError("Add a testbench and reference solution before validating.", status_code=422)

    gate = run_gate(problem_spec_from_orm(problem))
    db.add(
        ProblemValidation(
            problem_id=problem.id, ok=gate.ok, ref_score=gate.ref_score, stub_score=gate.stub_score, log=gate.log
        )
    )
    problem.status = ProblemStatus.validated if gate.ok else ProblemStatus.draft
    db.commit()

    return ValidationOut(ok=gate.ok, ref_score=gate.ref_score, stub_score=gate.stub_score, log=gate.log)


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
