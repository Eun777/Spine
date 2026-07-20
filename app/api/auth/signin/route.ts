import { NextResponse } from "next/server";
import { apiError, readJson } from "@/lib/api-response";
import { getSupabaseConfig, setSessionCookies } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return apiError("Supabase is not configured", { status: 503 });

  const body = await readJson(request);
  const email = body && typeof body === "object" ? String((body as { email?: unknown }).email || "").trim().toLowerCase() : "";
  const password = body && typeof body === "object" ? String((body as { password?: unknown }).password || "") : "";
  if (!email || !password) return apiError("Email and password are required", { status: 400 });

  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return apiError(data.msg || data.error_description || "Invalid email or password", { status: 401 });

  setSessionCookies(data);
  return NextResponse.json({ user: data.user });
}
