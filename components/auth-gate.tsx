"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ready" | "setup">("loading");
  const isPublic = pathname === "/login";

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.configured) setState("setup");
        else if (!data.user && !isPublic) router.replace("/login");
        else if (data.user && isPublic) router.replace("/");
        else setState("ready");
      })
      .catch(() => setState("setup"));
  }, [isPublic, router]);

  if (state === "loading") return <div className="page-loader" aria-label="Loading"><span /></div>;
  if (state === "setup" && !isPublic) return <section className="shell auth-shell"><div className="auth-card"><p className="eyebrow">Setup required</p><h1>Connect Supabase</h1><p className="lede">Add <code>SUPABASE_URL</code>, <code>SUPABASE_ANON_KEY</code>, and <code>BOOK_SCAN_ACCESS_CODE</code> to <code>.env.local</code>, then restart the app.</p></div></section>;
  return <>{children}</>;
}
