"""Stage 1 — static check.

Runs before the compiler ever sees the code. Regex, not a full parser:
fast, and sufficient for the constructs we need to ban. A false positive
here just makes a student rephrase a comment; a false negative in the
sandbox is the failure mode that actually matters, and rlimits + timeouts
in `sim.py` are the real backstop for anything this misses.
"""

from __future__ import annotations

import re

from app.engine.types import ProblemSpec

DEFAULT_BANNED_TASKS = ("$system", "$fopen", "$readmemh", "$readmemb", "$writememh", "$writememb", "$fscanf")

_INITIAL_RE = re.compile(r"\binitial\b")
_DELAY_RE = re.compile(r"#\s*\d")
_EDGE_RE = re.compile(r"\b(posedge|negedge)\b")


def _strip_comments(code: str) -> str:
    """Remove // and /* */ comments so banned tokens inside comments don't
    false-positive, and so hidden tokens can't be smuggled past the regex
    check by wrapping them in a comment-like string the compiler still
    executes (Verilog has no such trick, but keep the check honest)."""
    code = re.sub(r"//.*", "", code)
    code = re.sub(r"/\*.*?\*/", "", code, flags=re.DOTALL)
    return code


def static_check(code: str, spec: ProblemSpec, max_bytes: int) -> str | None:
    """Returns a human-readable rejection reason, or None if the code passes."""

    if len(code.encode("utf-8")) > max_bytes:
        return f"Submission exceeds the {max_bytes}-byte limit."

    scan = _strip_comments(code)

    banned = spec.banned_tasks or list(DEFAULT_BANNED_TASKS)
    for task in banned:
        if task in scan:
            return f"Use of {task} is not allowed in a submission."

    if _INITIAL_RE.search(scan):
        return "`initial` blocks are not allowed in the design — they cannot be synthesized to hardware."

    if _DELAY_RE.search(scan):
        return "Delay statements (`#<n>`) are not allowed in the design — they cannot be synthesized to hardware."

    if spec.kind == "combinational" and _EDGE_RE.search(scan):
        return "This problem is combinational — `posedge`/`negedge` are not expected here."

    return None
