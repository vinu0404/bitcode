"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getMe, logout } from "@/lib/api";
import { useAuthReady } from "@/lib/auth";
import { useModKey } from "@/lib/hotkeys";
import Button from "@/components/ui/Button";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { openCommandPalette } from "./CommandPalette";
import { ShortcutChip } from "./Marks";

const LINKS = [
  { href: "/bitcode", label: "Problems", exact: true },
  { href: "/bitcode/progress", label: "Progress", exact: false },
];

/** The Bitronics chip logo, then the product name. `public/logo-chip.png` is
 * `public/logo.jpg` with its white surround removed, so it sits on any
 * theme; the original JPEG is kept untouched beside it. */
export function Wordmark({ size = 30, product = true }: { size?: number; product?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.4) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-chip.png" alt="Bitronics" height={size} width={Math.round((size * 592) / 288)} style={{ display: "block", height: size, width: "auto" }} />
      {product && (
        <>
          <span aria-hidden style={{ width: 1, height: Math.round(size * 0.7), background: "var(--border-strong)" }} />
          <span className="display" style={{ fontSize: Math.round(size * 0.56), letterSpacing: "-0.02em" }}>
            Bitcode
          </span>
        </>
      )}
    </span>
  );
}

export default function AppHeader() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const ready = useAuthReady();
  const mod = useModKey();
  const me = useQuery({ queryKey: ["me"], queryFn: getMe, enabled: ready === true, staleTime: 5 * 60_000 });

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        height: 56,
        display: "flex",
        alignItems: "center",
        gap: 28,
        padding: "0 24px",
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Link href="/bitcode" aria-label="Bitcode home">
        <Wordmark />
      </Link>
      <nav style={{ display: "flex", gap: 4 }}>
        {LINKS.map((l) => {
          const on = l.exact ? pathname === l.href : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={on ? "page" : undefined}
              style={{
                padding: "6px 10px",
                fontSize: 14,
                fontWeight: 600,
                color: on ? "var(--fg)" : "var(--fg-muted)",
                borderBottom: on ? "2px solid var(--ch3)" : "2px solid transparent",
              }}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={openCommandPalette}
          aria-label="Open command palette"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            height: 32,
            padding: "0 8px 0 12px",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-sm)",
            background: "transparent",
            color: "var(--fg-muted)",
            fontSize: 13,
          }}
        >
          Search
          <ShortcutChip keys={[mod, "K"]} />
        </button>
        <ThemeToggle />
        {me.data?.role === "admin" && (
          <Link href="/admin">
            <Button variant={pathname.startsWith("/admin") ? "primary" : "secondary"} size="sm">
              Admin
            </Button>
          </Link>
        )}
        {me.data ? (
          <>
            <span className="mono" style={{ fontSize: 12, color: "var(--fg-faint)" }}>
              {me.data.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Log out
            </Button>
          </>
        ) : ready === false ? (
          <Link href="/login" style={{ fontSize: 14, color: "var(--fg-muted)" }}>
            Log in
          </Link>
        ) : null}
      </div>
    </header>
  );
}
