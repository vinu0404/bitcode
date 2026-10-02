"use client";

import { Dithering, MeshGradient } from "@paper-design/shaders-react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme";

/** The marketing hero: an oscilloscope-like field built from Paper Shaders
 * (Apache-2.0). Three layers:
 *   1. a slow mesh gradient in ink and channel colours,
 *   2. an 8x8 Bayer dither of a warp field in CH3, like phosphor on glass,
 *   3. a CH1 "probe" dither that follows the cursor through a soft mask.
 * Reduced motion freezes every layer on one frame and drops the probe.
 * Marketing surfaces only (landing, login); the app itself stays calm. */
export default function ScopeField({ interactive = true, intensity = 1 }: { interactive?: boolean; intensity?: number }) {
  const theme = useTheme();
  const ink = theme === "ink";
  const ref = useRef<HTMLDivElement>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // The probe eases toward the cursor rather than snapping to it.
  useEffect(() => {
    const el = ref.current;
    if (!el || !interactive || still || !window.matchMedia("(pointer: fine)").matches) return;
    let tx = 0.7, ty = 0.35, x = tx, y = ty, raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width;
      ty = (e.clientY - r.top) / r.height;
    };
    const tick = () => {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      el.style.setProperty("--px", `${(x * 100).toFixed(2)}%`);
      el.style.setProperty("--py", `${(y * 100).toFixed(2)}%`);
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [interactive, still]);

  const speed = still ? 0 : 1;
  const layer: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };

  return (
    <div
      ref={ref}
      aria-hidden
      style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", ["--px" as string]: "70%", ["--py" as string]: "35%" }}
    >
      <MeshGradient
        style={{ ...layer, opacity: intensity }}
        colors={ink ? ["#0B0E1A", "#16224F", "#7A2410", "#2A0F4A", "#0B0E1A"] : ["#F4F1EA", "#C9D6FF", "#FFD2C2", "#E9D7FF", "#F4F1EA"]}
        distortion={0.85}
        swirl={0.35}
        grainOverlay={0.12}
        speed={0.18 * speed}
        maxPixelCount={1920 * 1080}
      />
      <Dithering
        style={{ ...layer, mixBlendMode: ink ? "screen" : "multiply", opacity: (ink ? 0.55 : 0.35) * intensity }}
        colorBack="#00000000"
        colorFront={ink ? "#3D7BFF" : "#2156DC"}
        shape="warp"
        type="8x8"
        size={2.5}
        scale={0.9}
        speed={0.35 * speed}
        maxPixelCount={1920 * 1080}
      />
      {interactive && !still && (
        <Dithering
          style={{
            ...layer,
            mixBlendMode: ink ? "screen" : "multiply",
            opacity: 0.9 * intensity,
            WebkitMaskImage: "radial-gradient(260px circle at var(--px) var(--py), #000 0%, transparent 70%)",
            maskImage: "radial-gradient(260px circle at var(--px) var(--py), #000 0%, transparent 70%)",
          }}
          colorBack="#00000000"
          colorFront={ink ? "#FF5A36" : "#C93D1C"}
          shape="ripple"
          type="4x4"
          size={3}
          scale={1.4}
          speed={0.8}
          maxPixelCount={1920 * 1080}
        />
      )}
      {/* fade into the page so text and the next section stay readable */}
      <div style={{ ...layer, background: "linear-gradient(180deg, transparent 35%, var(--bg) 100%)" }} />
    </div>
  );
}
