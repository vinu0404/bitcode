"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Language, ProblemDetail } from "@/lib/api";
import { DOMAINS, LANGUAGE_NAME, padNumber } from "@/lib/domains";
import { markTransitionReady, navigateWithTransition, vtName } from "@/lib/viewTransition";
import { DifficultySignal, DomainBadge } from "@/components/bc/Marks";
import Button, { ArrowIcon, PlayIcon } from "@/components/ui/Button";

function Timer() {
  const [start] = useState(() => Date.now());
  const [paused, setPaused] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const elapsed = Math.max(0, Math.floor(((paused ?? now) - start - offset) / 1000));
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <button
      onClick={() => {
        if (paused === null) setPaused(Date.now());
        else {
          setOffset((o) => o + (Date.now() - paused));
          setPaused(null);
        }
      }}
      title={paused === null ? "Pause timer" : "Resume timer"}
      aria-label={`Time on this problem ${mm}:${ss}${paused !== null ? ", paused" : ""}`}
      className="mono tnum"
      style={{
        height: 28,
        padding: "0 8px",
        border: 0,
        background: "transparent",
        fontSize: 13,
        color: paused === null ? "var(--fg-muted)" : "var(--fg-faint)",
      }}
    >
      {mm}:{ss}
    </button>
  );
}

export default function TopBar({
  problem,
  language,
  onLanguage,
  onRun,
  onSubmit,
  busy,
  mod,
  pulse,
  compact,
}: {
  problem: ProblemDetail;
  language: Language;
  onLanguage: (l: Language) => void;
  onRun: () => void;
  onSubmit: () => void;
  busy: "run" | "submit" | null;
  mod: string;
  pulse: number; // bump to play the all-pass pulse along the strip
  compact: boolean;
}) {
  const ch = DOMAINS[problem.domain];
  const router = useRouter();
  // The number and title are on screen: let a morph from the list run.
  useEffect(() => markTransitionReady(), []);
  return (
    <header style={{ flex: "none", position: "relative" }}>
      {/* the 3px domain strip at the very top; an all-pass sends one white pulse along it */}
      <div style={{ height: 3, background: ch.fill, position: "relative", overflow: "hidden" }}>
        {pulse > 0 && (
          <span
            key={pulse}
            style={{
              position: "absolute",
              inset: 0,
              width: "40%",
              background: "linear-gradient(90deg, transparent, #fff, transparent)",
              animation: "bc-pulse-strip 900ms cubic-bezier(0.65,0,0.35,1) forwards",
            }}
          />
        )}
      </div>
      <div
        style={{
          height: 48,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 12px",
          borderBottom: "1px solid var(--border)",
          minWidth: 0,
        }}
      >
        <Link
          href="/bitcode"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            navigateWithTransition(router, "/bitcode");
          }}
          aria-label="Back to problems"
          style={{ display: "inline-flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", color: "var(--fg-muted)", borderRadius: "var(--r-inline)" }}
        >
          <ArrowIcon dir="left" />
        </Link>
        <span className="mono tnum" style={{ fontSize: 13, color: "var(--fg-muted)", viewTransitionName: vtName("num", problem.slug) } as React.CSSProperties}>
          {padNumber(problem.number)}
        </span>
        <h1
          style={{
            fontSize: compact ? 16 : 22,
            fontWeight: 600,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
            viewTransitionName: vtName("title", problem.slug),
          } as React.CSSProperties}
        >
          {problem.title}
        </h1>
        {!compact && (
          <>
            <DomainBadge domain={problem.domain} />
            <DifficultySignal difficulty={problem.difficulty} />
          </>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
          {!compact && <Timer />}
          <select
            value={language}
            onChange={(e) => onLanguage(e.target.value as Language)}
            aria-label="Language"
            className="mono"
            style={{
              height: 32,
              padding: "0 8px",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border-strong)",
              background: "transparent",
              fontSize: 12,
              color: "var(--fg)",
            }}
          >
            {(["sv", "v"] as Language[]).map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_NAME[l]}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="md"
            icon={<PlayIcon />}
            shortcut={compact ? undefined : [mod, "⏎"]}
            loading={busy === "run"}
            disabled={busy !== null && busy !== "run"}
            onClick={onRun}
          >
            Run
          </Button>
          <Button
            variant="primary"
            size="md"
            shortcut={compact ? undefined : [mod, "⇧", "⏎"]}
            loading={busy === "submit"}
            loadingLabel="Grading"
            disabled={busy !== null && busy !== "submit"}
            onClick={onSubmit}
          >
            Submit
          </Button>
        </div>
      </div>
    </header>
  );
}
