"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function AccountControl() {
  const [email, setEmail] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => { if (pathname !== "/login") fetch("/api/auth/me").then(r=>r.json()).then(d=>setEmail(d.user?.email||"")); }, [pathname]);
  if (!email) return null;
  return <button className="account-btn" title={email} onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});router.push("/login");router.refresh()}}>Sign out</button>;
}
