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

SYSTEM_PROMPT = """\
You write Icarus Verilog (iverilog -g2012) testbenches and reference solutions for Bitcode, a hardware practice platform. A human admin reviews your draft, and it must pass the platform's validation gate before students see it: the reference must score 100 and a stub must score below 100. Write the simplest readable code that does that.

Testbench contract. The platform parses stdout, so follow it exactly:
- First line: `timescale 1ns/1ps. One top module named tb that instantiates the DUT with named port connections.
- Do not call $dumpfile or $dumpvars. The platform adds waveform capture itself.
- Run the tests in exactly the order given, once each, using exactly the given ids and no others. Visible tests come first in the list and must run before any hidden one.
- For each test print ONE line: $display("##TEST <id> PASS exp=%h got=%h", expected, actual); or the same line with FAIL. Decide with !== so X and Z never pass. Use %h for buses and %b for single bits, with no spaces inside the exp= and got= values.
- After the last test: $display("##DONE"); $finish;
- In a separate initial block: #10000 $display("##TIMEOUT"); $finish; (longer if the tests need it).
- Combinational designs: drive inputs, wait #5, then compare. Sequential designs: generate clk with a forever loop; change inputs only mid-cycle, right after @(posedge clk); #1; never at the instant of the edge that samples them, because that is a race; sample outputs just after the edge. Apply and release reset exactly as the constraints describe (reset_sync, reset_active_high), and release it away from a clock edge.
- Each test checks the one behaviour named by its purpose, including the edge values it implies (zero, maximum, wrap-around, back-to-back changes). Make tests as independent as possible.
- Never write a check that is always true. The testbench must fail against a wrong design.

Reference solution:
- The exact module name, and the exact port names, directions and widths given.
- Synthesisable, idiomatic SystemVerilog (always_ff, always_comb, logic).
- No $display, $monitor, $dumpfile or $finish, no delays.
- Combinational: no latches. Sequential: non-blocking assignments in the clocked block.

Return only the two fields. Put code only in them, with no markdown fences and no commentary. Never use em dashes in comments.
"""


class AiDraftResult:
    def __init__(self, testbench_sv: str, reference_sv: str) -> None:
        self.testbench_sv = testbench_sv
        self.reference_sv = reference_sv


def draft_problem_assets(
    module: str, kind: str, ports: list[Port], tests: list[TestMeta], constraints: dict
) -> AiDraftResult:
    port_desc = "\n".join(f"  - {p.name}: {p.dir}, width {p.width}" for p in ports)
    test_desc = "\n".join(
        f"  - {t.test_id} [{'visible' if t.visible else 'hidden'}]: {t.purpose} (category={t.category})" for t in tests
    )

    user_prompt = (
        f"Module: {module}\nKind: {kind}\nConstraints: {json.dumps(constraints)}\n\n"
        f"Ports:\n{port_desc}\n\nTests to implement:\n{test_desc}\n\n"
        "Write the testbench and the reference solution."
    )

    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key, timeout=settings.openai_authoring_timeout_seconds)
    resp = client.chat.completions.create(
        model=settings.openai_model,
        messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_prompt}],
        response_format={"type": "json_schema", "json_schema": DRAFT_SCHEMA},
        reasoning_effort="medium",  # correct timing and races matter more than speed here
        max_completion_tokens=settings.openai_max_output_tokens * 5,  # a testbench is far longer than a feedback sentence
    )
    payload = json.loads(resp.choices[0].message.content)
    return AiDraftResult(testbench_sv=payload["testbench_sv"], reference_sv=payload["reference_sv"])
