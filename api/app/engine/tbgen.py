"""Generate a comparison testbench from a problem's port list plus vectors
the student typed in; powers `POST /submissions/run` (tier 1 custom tests,
see the design doc). One generator serves every problem; adding problem #6
adds no generator code because everything problem-specific comes from
`ProblemSpec.ports`, not from a per-problem template.

The student's module and `reference.sv` are compiled into the SAME unit,
so the reference module is textually renamed first (`_rename_module`) to
avoid a duplicate-module-name error; both declare the same interface by
construction, which is exactly what the admin validation gate checks.
"""

from __future__ import annotations

import re

from app.engine.types import Port, ProblemSpec

_LITERAL_RE = re.compile(r"^\d+'[bBhHdDoO][0-9a-fA-Fxz_XZ]+$")


def rename_module(source: str, old_name: str, new_name: str) -> str:
    """Rename `module <old_name>` -> `module <new_name>` in a leaf module's
    source. Leaf modules (all five V1 problems) have no internal
    self-instantiation, so a single declaration-site rename is sufficient."""
    pattern = re.compile(rf"\bmodule\s+{re.escape(old_name)}\b")
    return pattern.sub(f"module {new_name}", source, count=1)


def to_verilog_literal(width: int, raw: str) -> str:
    """Accept 0x../0b../decimal or a full Verilog literal, normalize to
    `<width>'h<hex>`. Raises ValueError on anything else; never trust
    student-supplied vector text as raw source text."""
    raw = raw.strip()
    if _LITERAL_RE.match(raw):
        return raw
    if raw.lower().startswith("0x"):
        value = int(raw, 16)
    elif raw.lower().startswith("0b"):
        value = int(raw, 2)
    else:
        value = int(raw, 10)
    mask = (1 << width) - 1
    return f"{width}'h{value & mask:x}"


def _decl(port: Port) -> str:
    return f"logic [{port.width - 1}:0] {port.name};" if port.width > 1 else f"logic {port.name};"


def _port_conn(ports: list[Port], suffix: str) -> str:
    return ", ".join(f".{p.name}({p.name}{suffix if p.dir == 'output' else ''})" for p in ports)


def build_combinational_tb(spec: ProblemSpec, vectors: list[dict[str, str]]) -> str:
    inputs = [p for p in spec.ports if p.dir == "input"]
    outputs = [p for p in spec.ports if p.dir == "output"]
    ref_module = f"{spec.module}__ref"

    decls = "\n  ".join(_decl(p) for p in spec.ports)
    decls += "\n  " + "\n  ".join(_decl(Port(f"{p.name}__ref", p.dir, p.width)) for p in outputs)

    dut_conn = ", ".join(f".{p.name}({p.name})" for p in spec.ports)
    ref_conn = ", ".join(
        f".{p.name}({p.name})" if p.dir == "input" else f".{p.name}({p.name}__ref)" for p in spec.ports
    )

    steps = []
    for row in vectors:
        assigns = "; ".join(f"{p.name} = {to_verilog_literal(p.width, row[p.name])}" for p in inputs)
        in_fmt = " ".join(f"{p.name}=%0h" for p in inputs)
        in_args = ", ".join(p.name for p in inputs)
        out_fmt = " ".join(f"{p.name}=%0h" for p in outputs)
        out_args = ", ".join(p.name for p in outputs)
        ref_fmt = " ".join(f"{p.name}=%0h" for p in outputs)
        ref_args = ", ".join(f"{p.name}__ref" for p in outputs)
        match_expr = " && ".join(f"{p.name} === {p.name}__ref" for p in outputs) or "1'b1"
        steps.append(
            f'    {assigns}; #1;\n'
            f'    $display("##VEC in:{in_fmt} yours:{out_fmt} expected:{ref_fmt} %s", '
            f'{in_args}, {out_args}, {ref_args}, ({match_expr}) ? "MATCH" : "DIFF");'
        )
    body = "\n".join(steps)

    return f"""`timescale 1ns/1ps
module tb_custom;
  {decls}

  {spec.module} dut ({dut_conn});
  {ref_module} ref_inst ({ref_conn});

  initial begin
    $dumpfile("dump.vcd");
    $dumpvars(1, tb_custom);
  end

  initial begin
    #10000 $display("##TIMEOUT"); $finish;
  end

  initial begin
{body}
    $display("##DONE");
    $finish;
  end
endmodule
"""


def build_sequential_tb(spec: ProblemSpec, vectors: list[dict[str, str]]) -> str:
    """One row per clock cycle. Requires a 1-bit input port named `clk`."""
    clk_ports = [p for p in spec.ports if p.name == "clk" and p.dir == "input" and p.width == 1]
    if not clk_ports:
        raise ValueError("Sequential problem has no 1-bit input port named 'clk'.")

    inputs = [p for p in spec.ports if p.dir == "input" and p.name != "clk"]
    outputs = [p for p in spec.ports if p.dir == "output"]
    ref_module = f"{spec.module}__ref"

    decls = "\n  ".join(_decl(p) for p in spec.ports)
    decls += "\n  " + "\n  ".join(_decl(Port(f"{p.name}__ref", p.dir, p.width)) for p in outputs)

    dut_conn = ", ".join(f".{p.name}({p.name})" for p in spec.ports)
    ref_conn = ", ".join(
        f".{p.name}({p.name})" if p.dir == "input" else f".{p.name}({p.name}__ref)" for p in spec.ports
    )

    steps = []
    for i, row in enumerate(vectors):
        assigns = "; ".join(f"{p.name} = {to_verilog_literal(p.width, row[p.name])}" for p in inputs)
        in_fmt = " ".join(f"{p.name}=%0h" for p in inputs)
        in_args = ", ".join(p.name for p in inputs)
        out_fmt = " ".join(f"{p.name}=%0h" for p in outputs)
        out_args = ", ".join(p.name for p in outputs)
        ref_fmt = " ".join(f"{p.name}=%0h" for p in outputs)
        ref_args = ", ".join(f"{p.name}__ref" for p in outputs)
        match_expr = " && ".join(f"{p.name} === {p.name}__ref" for p in outputs) or "1'b1"
        steps.append(
            f'    {assigns};\n'
            f'    @(posedge clk); #1;\n'
            f'    $display("##VEC cycle:{i} in:{in_fmt} yours:{out_fmt} expected:{ref_fmt} %s", '
            f'{in_args}, {out_args}, {ref_args}, ({match_expr}) ? "MATCH" : "DIFF");'
        )
    body = "\n".join(steps)

    return f"""`timescale 1ns/1ps
module tb_custom;
  {decls}

  {spec.module} dut ({dut_conn});
  {ref_module} ref_inst ({ref_conn});

  initial clk = 0;
  always #5 clk = ~clk;

  initial begin
    $dumpfile("dump.vcd");
    $dumpvars(1, tb_custom);
  end

  initial begin
    #10000 $display("##TIMEOUT"); $finish;
  end

  initial begin
    #1;
{body}
    $display("##DONE");
    $finish;
  end
endmodule
"""


def build_custom_tb(spec: ProblemSpec, vectors: list[dict[str, str]]) -> str:
    if spec.kind == "sequential":
        return build_sequential_tb(spec, vectors)
    return build_combinational_tb(spec, vectors)
