import { NextResponse } from "next/server";
import { apiError, readJson, readSupabaseError } from "@/lib/api-response";
import { isDuplicateBook, normalizeBookDraft } from "@/lib/book-utils";
import { supabaseEqFilter } from "@/lib/security";
import { getAuthenticatedUser, getSupabaseConfig, supabaseHeaders } from "@/lib/supabase-server";

export async function GET() {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return NextResponse.json({ books: [], storage: "local" });

  const session = await getAuthenticatedUser();
  if (!session) return apiError("Your session has expired. Please sign in again.", { status: 401 });

  const userFilter = supabaseEqFilter(session.user.id);
  const response = await fetch(`${url}/rest/v1/books?select=*&user_id=${userFilter}&order=created_at.desc`, {
    headers: supabaseHeaders(session.accessToken),
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await readSupabaseError(response, "Could not load books");
    return apiError(error.message, { status: 502, cause: error });
  }

  return NextResponse.json({ books: await response.json(), storage: "supabase" });
}

export async function POST(request: Request) {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return NextResponse.json({ storage: "local" });

  const session = await getAuthenticatedUser();
  if (!session) return apiError("Your session has expired. Please sign in again.", { status: 401 });

  const body = await readJson(request);
  const books = body && typeof body === "object" && "books" in body ? (body as { books?: unknown }).books : null;
  if (!Array.isArray(books)) return apiError("Books must be an array", { status: 400 });
  if (books.length > 50) return apiError("Save up to 50 books at a time", { status: 400 });

  const normalizedBooks = books.map(normalizeBookDraft).filter((book): book is NonNullable<ReturnType<typeof normalizeBookDraft>> => Boolean(book));
  if (!normalizedBooks.length) return apiError("At least one book with a title is required", { status: 400 });

  const userFilter = supabaseEqFilter(session.user.id);
  const lookup = await fetch(`${url}/rest/v1/books?select=isbn,title,author&user_id=${userFilter}`, {
    headers: supabaseHeaders(session.accessToken),
    cache: "no-store",
  });

  if (!lookup.ok) {
    const error = await readSupabaseError(lookup, "Could not check existing books");
    return apiError(error.message, { status: 502, cause: error });
  }

  const existing = await lookup.json();
  if (!Array.isArray(existing)) return apiError("Supabase returned an invalid duplicate-check response", { status: 502 });

  const now = new Date().toISOString();
  const unique = normalizedBooks
    .filter((book) => !existing.some((saved: any) => isDuplicateBook(book, saved)))
    .map((book) => ({
      ...book,
      id: crypto.randomUUID(),
      user_id: session.user.id,
      created_at: now,
      updated_at: now,
    }));

  let inserted: unknown[] = [];
  if (unique.length) {
    const response = await fetch(`${url}/rest/v1/books`, {
      method: "POST",
      headers: { ...supabaseHeaders(session.accessToken), Prefer: "return=representation" },
      body: JSON.stringify(unique),
    });

    if (!response.ok) {
      const error = await readSupabaseError(response, "Could not save books");
      return apiError(error.message, { status: 502, cause: error });
    }

    inserted = await response.json();
  }

  return NextResponse.json({ books: inserted, skipped: normalizedBooks.length - unique.length, storage: "supabase" });
}
