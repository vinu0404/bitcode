import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import NavBar from "@/components/NavBar";

// Self-hosted at build time by next/font — no runtime request to Google,
// no layout shift from a late font swap. Fraunces is the one deliberate
// character choice here: a serif with real weight and slight quirkiness
// at display size — the "old technical manual" note — while body copy
// stays a plain, fast-reading sans and code/data stays monospace.
const body = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
});
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "BitCode",
  description: "Practice HDL problems with real simulation-backed grading.",
};

// Runs before paint, in <head>, before React hydrates — reads the user's
// saved theme choice and stamps it on <html> immediately. Without this,
// the page always paints once in the default (light) tokens and then
// flashes to dark a moment later for anyone who chose dark explicitly.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('bitcode-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <NavBar />
          <main style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px 80px" }}>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
