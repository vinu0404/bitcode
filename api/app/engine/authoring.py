"""AI is used to help an admin AUTHOR a new problem's testbench and
reference solution; never to grade one. This is the "Draft with AI"
button in step 4 of the admin wizard (design doc §7): a starting point the
admin reviews, edits, and must pass through the validation gate before
publishing. If this call fails for any reason, the admin just writes the
testbench by hand; nothing downstream depends on this succeeding.
"""

from __future__ import annotations

import json

from app.config import settings
from app.engine.types import Port, TestMeta

DRAFT_SCHEMA = {
    "name": "hdl_problem_draft",
    "schema": {
        "type": "object",
        "properties": {
            "testbench_sv": {"type": "string"},
            "reference_sv": {"type": "string"},
        },
        "required": ["testbench_sv", "reference_sv"],
        "additionalProperties": False,
    },
    "strict": True,
}

SYSTEM_PROMPT = (
    "You write Icarus Verilog (-g2012) testbenches and reference solutions for a hardware "
    "practice platform. The testbench must print one line per test in EXACTLY this format: "
    '`$display("##TEST <id> PASS|FAIL exp=<val> got=<val>", ...)`, then `$display("##DONE");` '
    "and `$finish;` at the end, plus a `#10000 $display(\"##TIMEOUT\"); $finish;` guard in a "
    "separate initial block. Use only the exact test ids given. Every input change to a "
    "sequential DUT must happen safely mid-cycle (right after `@(posedge clk); #1;`), never in "
    "the same instant as the edge that samples it; that is a race condition. The reference "
    "solution must be a correct, idiomatic implementation with the exact module name and ports "
    "given. This is a first DRAFT for a human reviewer, not a final answer."
)


class AiDraftResult:
    def __init__(self, testbench_sv: str, reference_sv: str) -> None:
        self.testbench_sv = testbench_sv
        self.reference_sv = reference_sv


def draft_problem_assets(
    module: str, kind: str, ports: list[Port], tests: list[TestMeta], constraints: dict
) -> AiDraftResult:
    port_desc = "\n".join(f"  - {p.name}: {p.dir}, width {p.width}" for p in ports)
    test_desc = "\n".join(f"  - {t.test_id}: {t.purpose} (category={t.category})" for t in tests)

    user_prompt = (
        f"Module: {module}\nKind: {kind}\nConstraints: {json.dumps(constraints)}\n\n"
        f"Ports:\n{port_desc}\n\nTests to implement:\n{test_desc}\n\n"
        "Return JSON {testbench_sv, reference_sv}."
    )

    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key, timeout=settings.openai_timeout_seconds)
    resp = client.chat.completions.create(
        model=settings.openai_model,
        messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_prompt}],
        response_format={"type": "json_schema", "json_schema": DRAFT_SCHEMA},
        max_tokens=settings.openai_max_output_tokens * 4,  # a testbench is much longer than a feedback sentence
    )
    payload = json.loads(resp.choices[0].message.content)
    return AiDraftResult(testbench_sv=payload["testbench_sv"], reference_sv=payload["reference_sv"])
