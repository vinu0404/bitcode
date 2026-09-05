"""Parses the VCD file iverilog dumps for `/run` (see tbgen.py's
`$dumpfile`/`$dumpvars`) into the compact JSON-able shape the frontend's
waveform viewer renders directly — no VCD grammar needed in the browser.

Scoped to iverilog's own dialect, not general VCD: `$var wire <width> <id>
<name> [<range>] $end` declarations, then `#<time>` markers interleaved
with scalar (`0!`, `1"`, `x#`) and vector (`b0101 !`) value changes. Real
numbers and $comment/$attrbegin extensions never appear in our generated
testbenches, so they're not handled.
"""

from __future__ import annotations

import re

from app.engine.types import WaveSignal, Waveform

_VAR_RE = re.compile(r"^\$var\s+(\S+)\s+(\d+)\s+(\S+)\s+(\S+)")
_TIME_RE = re.compile(r"^#(\d+)")
_VECTOR_RE = re.compile(r"^[bB]([01xXzZ]+)\s+(\S+)")
_SCALAR_RE = re.compile(r"^([01xXzZ])(\S+)")
_TIMESCALE_VALUE_RE = re.compile(r"^\s*(\d+)\s*(fs|ps|ns|us|ms|s)\s*$")

# Every testbench this app generates declares `\`timescale 1ns/1ps` (see
# tbgen.py), so raw VCD ticks always come out in picoseconds. Rather than
# hardcode that, read it back from the VCD's own $timescale directive and
# convert to nanoseconds for display — the unit a clock period is normally
# reasoned about in — so the frontend never needs unit math.
_NS_PER_UNIT = {"fs": 1e-6, "ps": 1e-3, "ns": 1, "us": 1e3, "ms": 1e6, "s": 1e9}


def parse_vcd(text: str) -> Waveform | None:
    lines = text.splitlines()
    id_to_signal: dict[str, WaveSignal] = {}
    signals: list[WaveSignal] = []
    in_header = True
    time = 0
    end_time = 0
    ns_per_tick = 1.0
    pending_timescale = False

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if in_header:
            if pending_timescale:
                m = _TIMESCALE_VALUE_RE.match(line)
                if m:
                    magnitude, unit = int(m.group(1)), m.group(2)
                    ns_per_tick = magnitude * _NS_PER_UNIT[unit]
                pending_timescale = False
                continue
            if line.startswith("$timescale"):
                # Either `$timescale 1ps $end` on one line, or the value on
                # the next line — iverilog emits the latter.
                m = re.match(r"^\$timescale\s+(\d+)\s*(fs|ps|ns|us|ms|s)\s*\$end", line)
                if m:
                    magnitude, unit = int(m.group(1)), m.group(2)
                    ns_per_tick = magnitude * _NS_PER_UNIT[unit]
                else:
                    pending_timescale = True
                continue
            if line.startswith("$enddefinitions"):
                in_header = False
                continue
            m = _VAR_RE.match(line)
            if m:
                _kind, width_s, sig_id, name = m.groups()
                # A vector's $var line carries a trailing "[msb:lsb]" token
                # before $end — not part of the signal's name.
                sig = id_to_signal.get(sig_id)
                if sig is None:
                    sig = WaveSignal(name=name, width=int(width_s), changes=[])
                    id_to_signal[sig_id] = sig
                    signals.append(sig)
            continue

        tm = _TIME_RE.match(line)
        if tm:
            time = int(tm.group(1))
            end_time = max(end_time, time)
            continue

        if line[0] in "01xXzZ":
            sm = _SCALAR_RE.match(line)
            if sm:
                value, sig_id = sm.groups()
                sig = id_to_signal.get(sig_id)
                if sig is not None:
                    sig.changes.append([time, value])
            continue

        if line[0] in "bB":
            vm = _VECTOR_RE.match(line)
            if vm:
                value, sig_id = vm.groups()
                sig = id_to_signal.get(sig_id)
                if sig is not None:
                    sig.changes.append([time, value])
            continue
        # $dumpvars / $end / $comment lines fall through and are ignored.

    if not signals:
        return None

    def to_ns(ticks: int) -> float:
        ns = ticks * ns_per_tick
        rounded = round(ns, 6)
        return int(rounded) if rounded == int(rounded) else rounded

    for sig in signals:
        sig.changes = [[to_ns(t), v] for t, v in sig.changes]
    return Waveform(end_time=to_ns(end_time), signals=signals)
