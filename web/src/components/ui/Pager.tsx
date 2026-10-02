"use client";

import Button from "./Button";

/** Offset and limit paging for a Page<T>. Prev and Next stay in place and
 * disable at the ends, so the next click always lands in the same spot. */
export default function Pager({
  total,
  limit,
  offset,
  onOffsetChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
}) {
  if (total <= limit) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, gap: 12 }}>
      <span className="mono tnum" style={{ fontSize: 12, color: "var(--fg-faint)" }}>
        {from} to {to} of {total}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => onOffsetChange(Math.max(0, offset - limit))}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={to >= total} onClick={() => onOffsetChange(offset + limit)}>
          Next
        </Button>
      </div>
    </div>
  );
}
