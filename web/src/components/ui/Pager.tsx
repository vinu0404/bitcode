"use client";

import Button from "./Button";

// Offset/limit paging UI for a Page<T> response — "X–Y of Z" plus
// Prev/Next, disabled at the ends rather than hidden (Fitts's Law: a
// disabled-but-present control keeps the layout stable between pages,
// so the reader's next click always lands in the same place).
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

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, gap: 12 }}>
      <span className="mono" style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
        {from}–{to} of {total}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => onOffsetChange(Math.max(0, offset - limit))}>
          Prev
        </Button>
        <Button variant="secondary" size="sm" disabled={to >= total} onClick={() => onOffsetChange(offset + limit)}>
          Next
        </Button>
      </div>
    </div>
  );
}
