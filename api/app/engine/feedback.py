"""Stage 5 — explain. The only stage that calls a model, and the only stage
that can be switched off (`FEEDBACK_ENABLED=false`) without changing a
single score. It receives failed test ids, categories, and purposes, plus
the author's own hint — never the vectors, so no hidden test can leak
through generated prose.

On any failure (timeout, API error, malformed JSON, schema mismatch) it
falls back to the first failed test's authored hint. Grading never depends
on the model being reachable.
"""

from __future__ import annotations

import json
import logging

from app.config import settings
from app.engine.types import AiFeedback, CompileResult, TestOutcome

logger = logging.getLogger(__name__)

FEEDBACK_SCHEMA = {
    "name": "hdl_feedback",
    "schema": {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "hint": {"type": "string"},
            "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
        },
        "required": ["summary", "hint", "confidence"],
        "additionalProperties": False,
    },
    "strict": True,
}

SYSTEM_PROMPT = (
    "You are a hardware design teaching assistant. A real simulator has already decided "
    "which behaviors passed or failed — you only explain why, in 2-4 concise sentences. "
    "Never claim to have run a simulation yourself; the simulator already did that. "
    "Never reveal specific input/output vectors, only the named failure categories given to you. "
    "Be direct and specific about the likely code defect."
)


def _fallback(outcomes: list[TestOutcome] | None, compile_error: str | None) -> AiFeedback:
    if compile_error:
        hint = "Fix the compiler error shown above before re-submitting."
    else:
        failed = [o for o in (outcomes or []) if o.status != "PASS"]
        hint = failed[0].purpose and f"Review: {failed[0].purpose}." or "Review the failed behavior checks above."
    return AiFeedback(
        summary="Automated feedback is temporarily unavailable; showing the authored hint instead.",
        hint=hint,
        confidence="low",
        model="fallback",
        generated=False,
    )


def _build_messages(
    module: str, code: str, outcomes: list[TestOutcome] | None, compile_result: CompileResult | None
) -> list[dict]:
    if compile_result and not compile_result.ok:
        user = (
            f"Module: {module}\n\nStudent code:\n{code}\n\n"
            f"Compiler error:\n{compile_result.errors}\n\n"
            "Translate this compiler error into a beginner-friendly explanation of what to fix. "
            "Return JSON {summary, hint, confidence}."
        )
        return [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user}]

    failed = [o for o in (outcomes or []) if o.status != "PASS"]
    failed_desc = "\n".join(f"- {o.id} (category={o.category}, purpose=\"{o.purpose}\")" for o in failed)
    passed_count = sum(1 for o in (outcomes or []) if o.status == "PASS")
    total = len(outcomes or [])
    user = (
        f"Module: {module}\n\nStudent code:\n{code}\n\n"
        f"Simulator result: {passed_count}/{total} passed.\n"
        f"Failed:\n{failed_desc}\n\n"
        "Return JSON {summary, hint, confidence}. 2-4 sentences. "
        "Do not reveal test vectors. Do not claim you ran a simulation."
    )
    return [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user}]


def generate_feedback(
    module: str,
    code: str,
    outcomes: list[TestOutcome] | None = None,
    compile_result: CompileResult | None = None,
) -> AiFeedback:
    if not settings.feedback_enabled:
        return _fallback(outcomes, compile_result.errors if compile_result and not compile_result.ok else None)

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key, timeout=settings.openai_timeout_seconds)
        messages = _build_messages(module, code, outcomes, compile_result)
        resp = client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            response_format={"type": "json_schema", "json_schema": FEEDBACK_SCHEMA},
            max_tokens=settings.openai_max_output_tokens,
        )
        payload = json.loads(resp.choices[0].message.content)
        return AiFeedback(
            summary=payload["summary"],
            hint=payload["hint"],
            confidence=payload["confidence"],
            model=settings.openai_model,
            generated=True,
        )
    except Exception:  # noqa: BLE001 — any failure here must degrade, never break grading
        logger.exception("AI feedback generation failed; falling back to authored hint")
        return _fallback(outcomes, compile_result.errors if compile_result and not compile_result.ok else None)
