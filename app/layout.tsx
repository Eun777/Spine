import type { Metadata, Viewport } from "next";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
import AccountControl from "@/components/account-control";
import "./globals.css";

export const metadata: Metadata = { title: "Spine — Your pocket library", description: "Scan and save the books around you." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f5f1e8" };

function Logo() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>;
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <header className="topbar">
      <Link href="/" className="brand"><Logo /><span>Spine</span></Link>
      <nav aria-label="Main navigation"><Link href="/" className="library-link">Library</Link><Link href="/search" className="search-nav">Search books</Link><Link href="/scan" className="nav-scan"><span>＋</span> Scan</Link><AccountControl /></nav>
    </header>
    <main><AuthGate>{children}</AuthGate></main>
  </body></html>;
}
