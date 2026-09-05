"use client";

// One decorative touch, used sparingly (dashboard + profile headers only)
// — a schematic trace line, the same "old electronics manual" note the
// architecture doc opened with. Structural devices should mean something:
// this one is just texture, so it stays quiet — thin, low-contrast, never
// competing with real content.
export default function CircuitTrace({ width = 220 }: { width?: number }) {
  return (
    <svg width={width} height={20} viewBox="0 0 220 20" fill="none" aria-hidden="true" style={{ display: "block" }}>
      <path
        d="M0 14 H30 V6 H55 V14 H85 V6 H110 V14 H140 V6 H165 V14 H195 V6 H220"
        stroke="var(--border-strong)"
        strokeWidth="1.4"
      />
      <circle cx="55" cy="6" r="2.2" fill="var(--accent)" />
      <circle cx="140" cy="6" r="2.2" fill="var(--signal)" />
    </svg>
  );
}
