import { NextResponse } from "next/server";
import { apiError, readJson } from "@/lib/api-response";
import { getSupabaseConfig, setSessionCookies } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return apiError("Supabase is not configured", { status: 503 });

  const body = await readJson(request);
  const email = body && typeof body === "object" ? String((body as { email?: unknown }).email || "").trim().toLowerCase() : "";
  const password = body && typeof body === "object" ? String((body as { password?: unknown }).password || "") : "";
  if (!email || !password || password.length < 8) return apiError("Use a password with at least 8 characters", { status: 400 });

  const response = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return apiError(data.msg || data.error_description || "Could not create account", { status: 400 });
  if (data.access_token) setSessionCookies(data);

  return NextResponse.json({ user: data.user, needsConfirmation: !data.access_token });
}
