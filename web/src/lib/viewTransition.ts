"use client";

// Shared-element page transitions with the View Transitions API. The browser
// snapshots the old page, we navigate, and the new page calls
// markTransitionReady() once the matching elements are on screen; elements
// with the same view-transition-name then morph between the two. Browsers
// without the API, and reduced motion, just navigate.

type Router = { push: (href: string) => void };
type VTDocument = Document & { startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> } };

let pending: (() => void) | null = null;

/** True while a view transition is waiting for, or animating, the new page.
 * Entrance animations skip themselves then, or the new snapshot would be
 * captured mid-fade. */
export function inViewTransition(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.vt === "1";
}

export function navigateWithTransition(router: Router, href: string): void {
  const doc = document as VTDocument;
  if (!doc.startViewTransition || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    router.push(href);
    return;
  }
  document.documentElement.dataset.vt = "1";
  // The browser may defer or skip the callback (a hidden page, another
  // transition already running). Navigation must never depend on it.
  let navigated = false;
  const go = () => {
    if (navigated) return;
    navigated = true;
    router.push(href);
  };
  const fallback = window.setTimeout(go, 150);
  const vt = doc.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        window.clearTimeout(fallback);
        pending = resolve;
        go();
        // Never hold the frozen snapshot for long if the new page is slow.
        window.setTimeout(() => {
          if (pending === resolve) {
            pending = null;
            resolve();
          }
        }, 700);
      }),
  );
  vt.finished.catch(() => {}).finally(() => delete document.documentElement.dataset.vt);
}

export function markTransitionReady(): void {
  const r = pending;
  pending = null;
  r?.();
}

/** The view-transition-name for a problem's shared elements. */
export function vtName(part: "num" | "title", slug: string): string {
  return `vt-${part}-${slug.replace(/[^a-z0-9_-]/gi, "")}`;
}
