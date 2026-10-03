"""Stage 1: static check.

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

# Banned on every problem, whatever its own banned list says. The student
# module shares stdout and the VCD with the hidden testbench, so a design
# that prints or dumps could read hidden stimuli back out through Run.
_ALWAYS_BANNED_RE = re.compile(
    r"\$(?:f?(?:display|write|strobe|monitor)[bho]?|dump\w*|info|warning|error|fatal)\b"
)

_INITIAL_RE = re.compile(r"\binitial\b")
_DELAY_RE = re.compile(r"#\s*\d")
_EDGE_RE = re.compile(r"\b(posedge|negedge)\b")


def _strip_comments(code: str) -> str:
    """Blank out // and /* */ comments so banned tokens inside comments don't
    false-positive. Newlines inside block comments are kept, so an offset in
    the result maps to the same line number as in the original."""
    code = re.sub(r"//[^\n]*", "", code)
    return re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), code, flags=re.DOTALL)


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def static_check(code: str, spec: ProblemSpec, max_bytes: int) -> str | None:
    """Returns a human-readable rejection reason, or None if the code passes.
    Reasons that point at a construct start with `Line N:` so the editor can
    jump to it."""

    if len(code.encode("utf-8")) > max_bytes:
        return f"Shorten the design: it is over the {max_bytes}-byte limit."

    scan = _strip_comments(code)

    m = _ALWAYS_BANNED_RE.search(scan)
    if m:
        return f"Line {_line_of(scan, m.start())}: remove {m.group(0)}. Designs cannot print or dump; use the Waveform tab to inspect signals."

    banned = spec.banned_tasks or list(DEFAULT_BANNED_TASKS)
    for task in banned:
        idx = scan.find(task)
        if idx >= 0:
            return f"Line {_line_of(scan, idx)}: remove {task}. It is not allowed in a submission."

    m = _INITIAL_RE.search(scan)
    if m:
        return f"Line {_line_of(scan, m.start())}: remove the `initial` block. It cannot be synthesised to hardware; use a reset instead."

    m = _DELAY_RE.search(scan)
    if m:
        return f"Line {_line_of(scan, m.start())}: remove the `#` delay. Delays cannot be synthesised to hardware."

    if spec.kind == "combinational":
        m = _EDGE_RE.search(scan)
        if m:
            return f"Line {_line_of(scan, m.start())}: remove `{m.group(0)}`. This problem is combinational, so use `always_comb` or `assign`."

    return None
