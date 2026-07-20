import { NextResponse } from "next/server";
import { apiError, readJson, readSupabaseError } from "@/lib/api-response";
import {
  DEFAULT_LIBRARY_PREFERENCES,
  libraryPreferencesService,
} from "@/lib/library-preferences";
import { supabaseEqFilter } from "@/lib/security";
import { getAuthenticatedUser, getSupabaseConfig, supabaseHeaders } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return NextResponse.json({ preferences: DEFAULT_LIBRARY_PREFERENCES, storage: "local" });

  const session = await getAuthenticatedUser();
  if (!session) return apiError("Authentication required", { status: 401 });

  const response = await fetch(`${url}/rest/v1/library_preferences?select=title,subtitle&user_id=${supabaseEqFilter(session.user.id)}&limit=1`, {
    headers: supabaseHeaders(session.accessToken),
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await readSupabaseError(response, "Could not load library preferences");
    return apiError(error.message, { status: 502, cause: error });
  }

  const rows = await response.json();
  const preferences = libraryPreferencesService.normalize(Array.isArray(rows) ? rows[0] : null);
  return NextResponse.json({ preferences, storage: "supabase" });
}

export async function PATCH(request: Request) {
  const { url, key } = getSupabaseConfig();
  const body = await readJson(request);
  const preferences = libraryPreferencesService.normalize(body);

  if (!url || !key) return NextResponse.json({ preferences, storage: "local" });

  const session = await getAuthenticatedUser();
  if (!session) return apiError("Authentication required", { status: 401 });

  const now = new Date().toISOString();
  const response = await fetch(`${url}/rest/v1/library_preferences?on_conflict=user_id`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(session.accessToken),
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      user_id: session.user.id,
      title: preferences.title,
      subtitle: preferences.subtitle,
      updated_at: now,
    }),
  });

  if (!response.ok) {
    const error = await readSupabaseError(response, "Could not save library preferences");
    return apiError(error.message, { status: 502, cause: error });
  }

  const rows = await response.json();
  return NextResponse.json({
    preferences: libraryPreferencesService.normalize(Array.isArray(rows) ? rows[0] : preferences),
    storage: "supabase",
  });
}
