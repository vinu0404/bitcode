"use client";

export interface WaveSignal {
  name: string;
  width: number;
  changes: [number, string][]; // [time in ns, value — "0"/"1"/"x"/"z" or a binary string for buses]
}

export interface Waveform {
  end_time: number;
  signals: WaveSignal[];
}

const ROW_H = 32;
const LABEL_W = 96;
const AXIS_H = 20;

function binToDisplay(bin: string): { text: string; undefined: boolean } {
  if (/[xXzZ]/.test(bin)) return { text: bin.length === 1 ? bin.toUpperCase() : `${bin.length}'b${bin}`, undefined: true };
  if (bin.length === 1) return { text: bin, undefined: false };
  const hexDigits = Math.ceil(bin.length / 4);
  const hex = parseInt(bin, 2).toString(16).toUpperCase().padStart(hexDigits, "0");
  return { text: `0x${hex}`, undefined: false };
}

function pickTickStep(endTime: number): number {
  if (endTime <= 20) return 1;
  if (endTime <= 60) return 5;
  if (endTime <= 200) return 10;
  return Math.ceil(endTime / 20 / 10) * 10;
}

function BitRow({ signal, pxPerNs, endTime }: { signal: WaveSignal; pxPerNs: number; endTime: number }) {
  const segments = signal.changes.map((c, i) => {
    const start = c[0];
    const end = i + 1 < signal.changes.length ? signal.changes[i + 1][0] : endTime;
    return { start, end, value: c[1] };
  });
  const high = 6;
  const low = ROW_H - 8;

  const path: string[] = [];
  segments.forEach((seg, i) => {
    const x0 = seg.start * pxPerNs;
    const x1 = seg.end * pxPerNs;
    const isX = /[xXzZ]/.test(seg.value);
    const y = isX ? (high + low) / 2 : seg.value === "1" ? high : low;
    if (i === 0) path.push(`M ${x0} ${y}`);
    else {
      // vertical transition from the previous segment's level to this one
      path.push(`L ${x0} ${y}`);
    }
    path.push(`L ${x1} ${y}`);
  });

  return (
    <svg width={endTime * pxPerNs} height={ROW_H} style={{ display: "block" }}>
      {segments.map((seg, i) => {
        const isX = /[xXzZ]/.test(seg.value);
        if (!isX) return null;
        return (
          <rect
            key={i}
            x={seg.start * pxPerNs}
            y={2}
            width={(seg.end - seg.start) * pxPerNs}
            height={ROW_H - 4}
            fill="var(--warn)"
            opacity={0.12}
          />
        );
      })}
      <path d={path.join(" ")} fill="none" stroke="var(--signal)" strokeWidth={1.7} style={{ filter: "drop-shadow(0 0 3px var(--signal-soft))" }} />
    </svg>
  );
}

function BusRow({ signal, pxPerNs, endTime }: { signal: WaveSignal; pxPerNs: number; endTime: number }) {
  const segments = signal.changes.map((c, i) => {
    const start = c[0];
    const end = i + 1 < signal.changes.length ? signal.changes[i + 1][0] : endTime;
    return { start, end, value: c[1] };
  });
  const top = 4;
  const bottom = ROW_H - 4;
  const bevel = 4;

  return (
    <svg width={endTime * pxPerNs} height={ROW_H} style={{ display: "block", overflow: "visible" }}>
      {segments.map((seg, i) => {
        const x0 = seg.start * pxPerNs;
        const x1 = seg.end * pxPerNs;
        const w = x1 - x0;
        const { text, undefined: isUndef } = binToDisplay(seg.value);
        const stroke = isUndef ? "var(--warn)" : "var(--signal)";
        const b = Math.min(bevel, w / 2);
        const points =
          i === 0
            ? `${x0},${top} ${x1 - b},${top} ${x1},${(top + bottom) / 2} ${x1 - b},${bottom} ${x0},${bottom}`
            : `${x0},${(top + bottom) / 2} ${x0 + b},${top} ${x1 - b},${top} ${x1},${(top + bottom) / 2} ${x1 - b},${bottom} ${x0 + b},${bottom}`;
        return (
          <g key={i}>
            <polygon points={points} fill="none" stroke={stroke} strokeWidth={1.4} />
            {w > 22 && (
              <text
                x={(x0 + x1) / 2}
                y={ROW_H / 2 + 4}
                textAnchor="middle"
                fontSize={11}
                fontFamily="ui-monospace, SF Mono, Menlo, monospace"
                fill={isUndef ? "var(--warn)" : "var(--text)"}
              >
                {text}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function WaveformViewer({ waveform }: { waveform: Waveform }) {
  const endTime = Math.max(waveform.end_time, 1);
  const pxPerNs = Math.min(60, Math.max(14, 480 / endTime));
  const totalWidth = endTime * pxPerNs;
  const tickStep = pickTickStep(endTime);
  const ticks = [];
  for (let t = 0; t <= endTime; t += tickStep) ticks.push(t);

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--bg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex" }}>
        <div style={{ flex: "none", width: LABEL_W }}>
          <div style={{ height: AXIS_H }} />
          {waveform.signals.map((s) => (
            <div
              key={s.name}
              className="mono"
              style={{
                height: ROW_H,
                display: "flex",
                alignItems: "center",
                paddingLeft: 10,
                fontSize: 12.5,
                color: "var(--text)",
                borderTop: "1px solid var(--border)",
              }}
              title={`${s.name}${s.width > 1 ? ` [${s.width - 1}:0]` : ""}`}
            >
              {s.name}
            </div>
          ))}
        </div>

        <div style={{ overflowX: "auto", flex: 1 }}>
          <div style={{ width: totalWidth }}>
            <svg width={totalWidth} height={AXIS_H} style={{ display: "block" }}>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={t * pxPerNs} x2={t * pxPerNs} y1={AXIS_H - 6} y2={AXIS_H} stroke="var(--border)" />
                  <text x={t * pxPerNs + 3} y={11} fontSize={9.5} fill="var(--text-dim)" className="mono">
                    {t}ns
                  </text>
                </g>
              ))}
            </svg>
            {waveform.signals.map((s) => (
              <div key={s.name} style={{ borderTop: "1px solid var(--border)" }}>
                {s.width === 1 ? (
                  <BitRow signal={s} pxPerNs={pxPerNs} endTime={endTime} />
                ) : (
                  <BusRow signal={s} pxPerNs={pxPerNs} endTime={endTime} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
