"""Generate an "empty stub" module for a given interface — the right ports,
no logic. Used by the admin validation gate (design doc §7, check 2): if a
testbench still scores this stub at 100, the testbench never actually
fails anything, which is the single most common defect in a hand-authored
testbench and would otherwise silently pass every student.

An undriven `output logic` port in Verilog floats at high-impedance ('z'),
which fails a `===` comparison against any concrete expected value — so a
correct testbench reliably scores this below 100.
"""

from __future__ import annotations

from app.engine.types import ProblemSpec


def build_stub_module(spec: ProblemSpec, comment: str = "intentionally empty — validation stub") -> str:
    port_lines = []
    for p in spec.ports:
        decl = f"logic [{p.width - 1}:0]" if p.width > 1 else "logic"
        port_lines.append(f"    {p.dir:<6} {decl} {p.name}")
    ports = ",\n".join(port_lines)
    return f"module {spec.module} (\n{ports}\n);\n    // {comment}\nendmodule\n"


def build_starter_code(spec: ProblemSpec) -> str:
    """The shell shown to students — same shape as the validation stub,
    but with the standard "write your code here" prompt (design doc §3's
    starter_code convention) instead of the validation comment."""
    return build_stub_module(spec, comment="Write your code here")
