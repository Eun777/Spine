import { cookies } from "next/headers";

export const ACCESS_COOKIE = "spine-sb-access";
export const REFRESH_COOKIE = "spine-sb-refresh";

type SupabaseSession = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user?: SupabaseUser;
};

export type SupabaseUser = {
  id: string;
  email?: string;
};

export function getSupabaseConfig() {
  return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
}

export function isSupabaseConfigured() {
  const { url, key } = getSupabaseConfig();
  return Boolean(url && key);
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export function setSessionCookies(session: SupabaseSession) {
  const jar = cookies();
  jar.set(ACCESS_COOKIE, session.access_token, cookieOptions(session.expires_in || 3600));
  if (session.refresh_token) jar.set(REFRESH_COOKIE, session.refresh_token, cookieOptions(60 * 60 * 24 * 30));
}

export function clearSessionCookies() {
  const jar = cookies();
  jar.set(ACCESS_COOKIE, "", cookieOptions(0));
  jar.set(REFRESH_COOKIE, "", cookieOptions(0));
  jar.set("spine-ai-access", "", cookieOptions(0));
}

async function fetchUser(accessToken: string): Promise<SupabaseUser | null> {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json();
}

export async function getAuthenticatedUser(): Promise<{ user: SupabaseUser; accessToken: string } | null> {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;
  const jar = cookies();
  let accessToken = jar.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    const user = await fetchUser(accessToken);
    if (user) return { user, accessToken };
  }

  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;
  const refreshed = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  if (!refreshed.ok) return null;
  const session = await refreshed.json();
  setSessionCookies(session);
  accessToken = session.access_token;
  if (!session.user?.id || !session.access_token) return null;
  return { user: session.user, accessToken: session.access_token as string };
}

export function supabaseHeaders(accessToken: string) {
  const { key } = getSupabaseConfig();
  return { apikey: key!, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}
