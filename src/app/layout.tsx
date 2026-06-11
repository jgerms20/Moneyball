import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Trader Mirror",
  description: "A private mirror of who you are as a trader.",
};

const NAV = [
  { href: "/", label: "The Mirror" },
  { href: "/timeline", label: "Timeline" },
  { href: "/patterns", label: "Patterns" },
  { href: "/options", label: "Options Psyche" },
  { href: "/swot", label: "SWOT of Me" },
  { href: "/walls", label: "Wins & Tuition" },
  { href: "/journal", label: "Journal" },
  { href: "/education", label: "Education" },
  { href: "/data", label: "Data" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${grotesk.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="mx-auto flex min-h-screen max-w-7xl">
          <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col border-r border-line px-5 py-8 md:flex">
            <Link href="/" className="font-display text-2xl text-brass-bright">
              Trader<span className="text-foreground"> Mirror</span>
            </Link>
            <p className="mt-1 text-[11px] uppercase tracking-widest text-faint">
              a private reflection
            </p>
            <nav className="mt-10 flex flex-col gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-surface2 hover:text-foreground"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto text-[11px] leading-relaxed text-faint">
              Your data never leaves this server.
            </div>
          </aside>
          <div className="min-w-0 flex-1">
            <header className="flex items-center gap-3 overflow-x-auto border-b border-line px-4 py-3 md:hidden">
              <Link href="/" className="font-display text-lg text-brass-bright">
                TM
              </Link>
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="whitespace-nowrap text-xs text-muted">
                  {n.label}
                </Link>
              ))}
            </header>
            <main className="px-5 py-8 md:px-10">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
