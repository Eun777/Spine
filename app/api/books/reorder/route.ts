import { NextResponse } from "next/server";
import { apiError, readJson, readSupabaseError } from "@/lib/api-response";
import { requireUuid, supabaseEqFilter } from "@/lib/security";
import { getAuthenticatedUser, getSupabaseConfig, supabaseHeaders } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const { url, key } = getSupabaseConfig();
    if (!url || !key) return NextResponse.json({ storage: "local" });

    const session = await getAuthenticatedUser();
    if (!session) return apiError("Authentication required", { status: 401 });

    const body = await readJson(request);
    const orderedIds = body && typeof body === "object" ? (body as { orderedIds?: unknown }).orderedIds : null;
    if (!Array.isArray(orderedIds) || orderedIds.length > 500) return apiError("Provide up to 500 ordered book IDs", { status: 400 });

    const now = new Date().toISOString();
    const bookIds = orderedIds.map((id) => requireUuid(id, "book id"));

    for (const [index, bookId] of bookIds.entries()) {
      const response = await fetch(`${url}/rest/v1/books?id=${supabaseEqFilter(bookId)}&user_id=${supabaseEqFilter(session.user.id)}`, {
        method: "PATCH",
        headers: supabaseHeaders(session.accessToken),
        body: JSON.stringify({ sort_order: index + 1, updated_at: now }),
      });

      if (!response.ok) {
        const error = await readSupabaseError(response, "Could not reorder books");
        return apiError(error.message, { status: 502, cause: error });
      }
    }

    return NextResponse.json({ ok: true, storage: "supabase" });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Could not reorder books", { status: 400, cause: error });
  }
}
