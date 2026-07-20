import { NextResponse } from "next/server";
import { apiError, readJson, readSupabaseError } from "@/lib/api-response";
import { isBookStatus } from "@/lib/book-utils";
import { getAuthenticatedUser, getSupabaseConfig, supabaseHeaders } from "@/lib/supabase-server";

type RouteContext = { params: { id: string } };

const MUTABLE_BOOK_FIELDS = [
  "title",
  "author",
  "isbn",
  "genre",
  "cover_image_url",
  "confidence_score",
  "description",
  "publisher",
  "published_date",
  "page_count",
  "categories",
  "language",
  "google_books_id",
  "open_library_id",
  "preview_url",
  "average_rating",
  "ratings_count",
  "metadata_source",
  "status",
] as const;

export async function DELETE(_: Request, { params }: RouteContext) {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return NextResponse.json({ storage: "local" });

  const session = await getAuthenticatedUser();
  if (!session) return apiError("Authentication required", { status: 401 });

  const response = await fetch(`${url}/rest/v1/books?id=eq.${encodeURIComponent(params.id)}&user_id=eq.${session.user.id}`, {
    method: "DELETE",
    headers: supabaseHeaders(session.accessToken),
  });

  if (!response.ok) {
    const error = await readSupabaseError(response, "Delete failed");
    return apiError(error.message, { status: 502, cause: error });
  }

  return NextResponse.json({ ok: true, storage: "supabase" });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return NextResponse.json({ storage: "local" });

  const session = await getAuthenticatedUser();
  if (!session) return apiError("Authentication required", { status: 401 });

  const body = await readJson(request);
  if (!body || typeof body !== "object") return apiError("Invalid request body", { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of MUTABLE_BOOK_FIELDS) {
    if (field in body) updates[field] = (body as Record<string, unknown>)[field];
  }

  if (updates.status !== undefined && !isBookStatus(updates.status)) {
    return apiError("Invalid reading status", { status: 400 });
  }

  const response = await fetch(`${url}/rest/v1/books?id=eq.${encodeURIComponent(params.id)}&user_id=eq.${session.user.id}`, {
    method: "PATCH",
    headers: { ...supabaseHeaders(session.accessToken), Prefer: "return=representation" },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await readSupabaseError(response, "Update failed");
    return apiError(error.message, { status: 502, cause: error });
  }

  const books = await response.json();
  return NextResponse.json({ book: books[0], storage: "supabase" });
}
