import type { Metadata } from "next";
import { JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Providers from "./providers";

// Self-hosted at build time by next/font: no runtime request to Google and
// no layout shift from a late swap. Basement Grotesque (SIL OFL 1.1, see
// public/fonts/basement-grotesque/LICENSE.txt) is only ever used for a few
// display words, so only its Black weight ships.
const sans = Schibsted_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });
const display = localFont({
  src: "../../public/fonts/basement-grotesque/BasementGrotesque-Black.woff2",
  weight: "900",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bitcode",
  description: "Practise hardware design on problems graded by a real simulator.",
};

// Runs in <head> before first paint, so a saved paper choice never flashes
// ink first. Kept here rather than imported: a string exported from a
// client module arrives in a server component as a reference, not a value.
const THEME_INIT = `(function(){try{if(localStorage.getItem('bitcode-theme')==='paper'){document.documentElement.setAttribute('data-theme','paper');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${sans.variable} ${mono.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
