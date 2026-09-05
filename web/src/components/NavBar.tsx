"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMe, logout } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Button from "@/components/ui/Button";
import ThemeToggle from "@/components/ui/ThemeToggle";

const NAV_LINKS = [
  { href: "/problems", label: "Problems" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      setEmail(null);
      setIsAdmin(false);
      return;
    }
    getMe()
      .then((u) => {
        setEmail(u.email);
        setIsAdmin(u.role === "admin");
      })
      .catch(() => {});
    // NavBar lives in the root layout and never remounts across client-side
    // navigations, so re-check auth on every route change — otherwise it
    // keeps showing "Log in" right after a successful login/register.
  }, [pathname]);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "13px 24px",
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <Link href="/problems" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="18" height="18" rx="4" stroke="var(--accent)" strokeWidth="1.6" />
            <path d="M6 10h2.4M11.6 10H14M10 6v2.4M10 11.6V14" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="10" cy="10" r="1.6" fill="var(--signal)" />
          </svg>
          <span style={{ fontFamily: "var(--f-display)", fontWeight: 600, fontSize: 17, letterSpacing: "-0.01em", color: "var(--text)" }}>
            Bit<span style={{ color: "var(--accent)" }}>Code</span>
          </span>
        </Link>

        <div style={{ display: "flex", gap: 4 }}>
          {NAV_LINKS.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13.5,
                  fontWeight: 500,
                  textDecoration: "none",
                  color: active ? "var(--text)" : "var(--text-dim)",
                  background: active ? "var(--surface-2)" : "transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 13.5 }}>
        <ThemeToggle />
        {isAdmin && (
          <Link href="/admin" style={{ textDecoration: "none" }}>
            <Button variant={pathname?.startsWith("/admin") ? "primary" : "secondary"} size="sm">
              Admin
            </Button>
          </Link>
        )}
        {email ? (
          <>
            <Link
              href="/profile"
              className="mono"
              style={{
                color: pathname === "/profile" ? "var(--text)" : "var(--text-dim)",
                fontWeight: pathname === "/profile" ? 600 : 400,
                fontSize: 12.5,
                textDecoration: "none",
              }}
            >
              {email}
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Log out
            </Button>
          </>
        ) : (
          <Link href="/login" style={{ color: "var(--text-dim)", textDecoration: "none" }}>
            Log in
          </Link>
        )}
      </div>
    </nav>
  );
}
