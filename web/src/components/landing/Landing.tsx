"use client";

import { animate, createDrawable, cubicBezier, stagger, type JSAnimation } from "animejs";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Wordmark } from "@/components/bc/AppHeader";
import { DifficultySignal, DomainBadge } from "@/components/bc/Marks";
import Magnet from "@/components/reactbits/Magnet";
import Button, { ArrowIcon } from "@/components/ui/Button";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { getCatalogue } from "@/lib/api";
import { useAuthReady } from "@/lib/auth";
import { DOMAIN_ORDER, DOMAINS, pad2, padNumber } from "@/lib/domains";
import ScopeField from "./ScopeField";
import SmoothScroll from "./SmoothScroll";
import WorkspacePreview from "./WorkspacePreview";

const EXPO_OUT = cubicBezier(0.16, 1, 0.3, 1);
const IN_OUT = cubicBezier(0.65, 0, 0.35, 1);

/** Entrance animations only run for a visible page without reduced motion.
 * anime.js pauses while the document is hidden, and text must never be left
 * parked below its mask: a background tab, a link preview or a crawler
 * renders the page hidden, so in those cases everything simply appears. */
function canAnimate(): boolean {
  if (typeof window === "undefined") return false;
  return !document.hidden && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Runs `play` once, the first time `ref` scrolls into view. */
function useReveal<T extends Element>(play: (el: T) => JSAnimation, threshold = 0.25) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !canAnimate()) return;
    let anim: JSAnimation | null = null;
    const onHide = () => document.hidden && anim?.complete();
    document.addEventListener("visibilitychange", onHide);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        if (canAnimate()) anim = play(el);
      },
      { threshold },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onHide);
      anim?.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

export default function Landing() {
  const authed = useAuthReady();
  const ctaHref = authed ? "/bitcode" : "/register";
  const ctaLabel = authed ? "Open problems" : "Start solving";

  // Hero: lines rise out of their masks, then the scope trace draws itself.
  const heroRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = heroRef.current;
    if (!root || !canAnimate()) return;
    const lines = root.querySelectorAll<HTMLElement>("[data-line]");
    const fades = root.querySelectorAll<HTMLElement>("[data-fade]");
    const paths = root.querySelectorAll<SVGPathElement>("[data-trace]");
    const anims = [
      animate(lines, { translateY: ["110%", "0%"], duration: 1100, delay: stagger(90, { start: 150 }), ease: EXPO_OUT }),
      animate(fades, { opacity: [0, 1], translateY: [12, 0], duration: 800, delay: stagger(80, { start: 650 }), ease: EXPO_OUT }),
      ...(paths.length ? [animate(createDrawable(paths), { draw: ["0 0", "0 1"], duration: 1800, delay: stagger(140, { start: 500 }), ease: IN_OUT })] : []),
    ];
    // If the tab is hidden mid-intro, jump to the end rather than freeze.
    const onHide = () => document.hidden && anims.forEach((a) => a.complete());
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      anims.forEach((a) => a.revert());
    };
  }, []);

  const channelsRef = useReveal<HTMLDivElement>((el) => {
    const rows = el.querySelectorAll<HTMLElement>("[data-row]");
    return animate(rows, { opacity: [0, 1], translateX: [-24, 0], duration: 800, delay: stagger(80), ease: EXPO_OUT });
  });
  const problemsRef = useReveal<HTMLDivElement>((el) => {
    const rows = el.querySelectorAll<HTMLElement>("[data-row]");
    return animate(rows, { opacity: [0, 1], translateY: [16, 0], duration: 700, delay: stagger(70), ease: EXPO_OUT });
  });

  // Public, read-only: number, title, difficulty and channel only.
  const catalogue = useQuery({ queryKey: ["public-catalogue"], queryFn: () => getCatalogue(4), staleTime: 5 * 60_000 });
  const openHref = (slug: string) => (authed ? `/bitcode/${slug}` : `/register?next=${encodeURIComponent(`/bitcode/${slug}`)}`);

  return (
    // overflow-x: clip, not hidden: hidden would make this a scroll
    // container, which breaks position: sticky inside it.
    <div style={{ background: "var(--bg)", color: "var(--fg)", overflowX: "clip" }}>
      <SmoothScroll />

      {/* ── nav ─────────────────────────────────────────────────────── */}
      <header style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 28, padding: "20px clamp(16px, 4vw, 48px)" }}>
        <Wordmark size={34} />
        <nav className="bc-landing-nav" style={{ display: "flex", gap: 24, fontSize: 14, fontWeight: 600, color: "var(--fg-muted)" }}>
          <a href="#preview">Preview</a>
          <a href="#problems">Problems</a>
          <a href="#channels">Channels</a>
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <ThemeToggle />
          {authed === false && (
            <Link href="/login" style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-muted)" }}>
              Log in
            </Link>
          )}
          <Link href={ctaHref}>
            <Button variant="primary" size="sm">
              {ctaLabel}
            </Button>
          </Link>
        </div>
      </header>

      {/* ── hero ────────────────────────────────────────────────────── */}
      <section ref={heroRef} style={{ position: "relative", minHeight: "100svh", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "120px clamp(16px, 4vw, 48px) 48px" }}>
        <ScopeField />
        <div style={{ position: "relative" }}>
          <p data-fade className="mono" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.2em", color: "var(--fg)", marginBottom: 24 }}>
            BITRONICS / HARDWARE DESIGN PRACTICE
          </p>
          <h1 className="display" style={{ fontSize: "clamp(56px, 12.5vw, 220px)", lineHeight: 0.86 }}>
            {["Write", "hardware.", "Prove it."].map((l, i) => (
              <span key={l} style={{ display: "block", overflow: "hidden", paddingBottom: "0.04em" }}>
                <span data-line style={{ display: "block", color: i === 2 ? "var(--ch1)" : undefined }}>
                  {l}
                </span>
              </span>
            ))}
          </h1>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 32, flexWrap: "wrap", marginTop: 40 }}>
            <p data-fade style={{ fontSize: "clamp(16px, 1.6vw, 20px)", lineHeight: 1.5, maxWidth: 520, color: "var(--fg)" }}>
              Solve Verilog and SystemVerilog problems in your browser. Get a verdict in seconds, and see every edge of every signal.
            </p>
            <div data-fade style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Magnet>
                <Link href={ctaHref}>
                  <Button variant="primary" size="lg" icon={<ArrowIcon />}>
                    {ctaLabel}
                  </Button>
                </Link>
              </Magnet>
              <a href="#preview">
                <Button variant="secondary" size="lg">
                  See how it feels
                </Button>
              </a>
            </div>
          </div>
        </div>
        {/* scope traces across the foot of the hero */}
        <svg viewBox="0 0 1200 90" preserveAspectRatio="none" aria-hidden style={{ position: "relative", width: "100%", height: 90, marginTop: 48 }}>
          <path data-trace d="M0 70H120V20H240V70H360V20H480V70H600V20H720V70H840V20H960V70H1080V20H1200" fill="none" stroke="var(--wave-clock)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <path data-trace d="M0 40H300L310 30H520L530 40L520 50H310L300 40M530 40H900L910 30H1200" fill="none" stroke="var(--wave-output)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <path data-trace d="M0 85H180V60H420V85H1200" fill="none" stroke="var(--wave-input)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </section>

      {/* ── what it is like to use ─────────────────────────────────── */}
      <section id="preview" style={{ padding: "96px clamp(16px, 4vw, 48px) 120px", maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap", marginBottom: 40 }}>
          <h2 className="display" style={{ fontSize: "clamp(44px, 6.5vw, 104px)", lineHeight: 0.9 }}>
            Code it.
            <br />
            <span style={{ color: "var(--pass)" }}>Know it works.</span>
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.55, color: "var(--fg-muted)", maxWidth: 360 }}>
            Nothing to install. Open a problem, write your module in the browser and press Submit.
          </p>
        </div>
        <WorkspacePreview />
      </section>

      {/* ── real problems from the catalogue ───────────────────────── */}
      <section id="problems" style={{ padding: "40px clamp(16px, 4vw, 48px) 120px", maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap", marginBottom: 32 }}>
          <h2 className="display" style={{ fontSize: "clamp(44px, 6.5vw, 104px)", lineHeight: 0.9 }}>
            Try one.
          </h2>
          <Link href={authed ? "/bitcode" : "/register?next=/bitcode"} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600, color: "var(--ch3-text)" }}>
            See all {catalogue.data ? pad2(catalogue.data.total) : ""} problems <ArrowIcon />
          </Link>
        </div>
        <div ref={problemsRef} style={{ borderTop: "1px solid var(--border)" }}>
          {(catalogue.data?.items ?? []).map((p) => (
            <Link key={p.slug} href={openHref(p.slug)} data-row className="bc-row bc-row-landing" style={{ ["--row-ch" as string]: DOMAINS[p.domain].fill }}>
              <span className="mono tnum" style={{ fontSize: 13, color: "var(--fg-muted)" }}>
                {padNumber(p.number)}
              </span>
              <span className="bc-row-title" style={{ fontSize: 20, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.title}
              </span>
              <span className="bc-hide-narrow">
                <DomainBadge domain={p.domain} />
              </span>
              <span className="bc-hide-narrow">
                <DifficultySignal difficulty={p.difficulty} />
              </span>
              <span className="bc-solve" aria-hidden>
                <ArrowIcon />
              </span>
            </Link>
          ))}
          {catalogue.isError && (
            <p style={{ padding: "18px 8px", color: "var(--fg-muted)", fontSize: 15 }}>
              The catalogue is not loading right now. <Link href="/bitcode" style={{ color: "var(--ch3-text)", fontWeight: 600 }}>Open the problem list</Link> instead.
            </p>
          )}
        </div>
      </section>

      {/* ── channels ───────────────────────────────────────────────── */}
      <section id="channels" style={{ padding: "40px clamp(16px, 4vw, 48px) 120px", maxWidth: 1240, margin: "0 auto" }}>
        <h2 className="display" style={{ fontSize: "clamp(44px, 6.5vw, 104px)", lineHeight: 0.9, marginBottom: 32 }}>
          Four channels.
        </h2>
        <div ref={channelsRef} style={{ borderTop: "1px solid var(--border)" }}>
          {DOMAIN_ORDER.map((d) => {
            const n = catalogue.data?.by_domain[d] ?? 0;
            return (
              <div key={d} data-row className="bc-channel-row" style={{ ["--row-ch" as string]: DOMAINS[d].fill }}>
                <DomainBadge domain={d} compact />
                <span className="display bc-channel-name" style={{ fontSize: "clamp(32px, 5vw, 72px)" }}>
                  {DOMAINS[d].label}
                </span>
                <span className="mono" style={{ marginLeft: "auto", fontSize: 12, letterSpacing: "0.12em", color: n ? DOMAINS[d].text : "var(--fg-faint)" }}>
                  {n ? `${pad2(n)} PROBLEMS` : "COMING SOON"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── final call ─────────────────────────────────────────────── */}
      <section style={{ position: "relative", padding: "120px clamp(16px, 4vw, 48px)", textAlign: "center", overflow: "hidden" }}>
        <div className="graticule" style={{ position: "absolute", inset: 0, opacity: 0.6 }} />
        <div style={{ position: "relative" }}>
          {/* The page's one sign-up close. Logged-in visitors get their own
              next step instead of a second link to the problem list. */}
          <h2 className="display" style={{ fontSize: "clamp(48px, 9vw, 150px)", lineHeight: 0.9 }}>
            {authed ? "Pick up where" : "Ready when"}
            <br />
            {authed ? "you left off." : "you are."}
          </h2>
          <p style={{ fontSize: 17, color: "var(--fg-muted)", margin: "20px auto 36px", maxWidth: 440 }}>
            {authed ? "Your streak, your next problem and your recent attempts are on your progress page." : "Free account. Your code and progress are saved as you go."}
          </p>
          <Magnet padding={120}>
            <Link href={authed ? "/bitcode/progress" : "/register"}>
              <Button variant="primary" size="lg" icon={<ArrowIcon />} style={{ height: 64, padding: "0 36px", fontSize: 18 }}>
                {authed ? "See your progress" : "Create free account"}
              </Button>
            </Link>
          </Magnet>
        </div>
      </section>

      <footer style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between", padding: "28px clamp(16px, 4vw, 48px)", borderTop: "1px solid var(--border)" }}>
        <Wordmark size={28} />
        <p style={{ fontSize: 12, color: "var(--fg-faint)", maxWidth: 720, lineHeight: 1.6 }}>
          Basement Grotesque by Basement Studio, SIL OFL 1.1. Shaders by Paper (Apache 2.0). Some components adapted from React Bits by David Haz.
        </p>
      </footer>
    </div>
  );
}
