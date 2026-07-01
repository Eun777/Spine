import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseConfig, supabaseHeaders } from "@/lib/supabase-server";
import { BOOK_STATUSES, type BookStatus } from "@/lib/types";

const validStatus = (value: unknown): value is BookStatus => BOOK_STATUSES.includes(value as BookStatus);
const clean = (value: string) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function supabaseError(response: Response, fallback: string) {
  const body = await response.json().catch(()=>({}));
  console.error(fallback, { status: response.status, code: body.code, message: body.message });
  return body.message || fallback;
}

export async function GET() {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return NextResponse.json({ books: [], storage: "local" });
  const session = await getAuthenticatedUser();
  if (!session) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  const response = await fetch(`${url}/rest/v1/books?select=*&user_id=eq.${session.user.id}&order=created_at.desc`, { headers: supabaseHeaders(session.accessToken), cache: "no-store" });
  if (!response.ok) return NextResponse.json({ error: await supabaseError(response, "Could not load books") }, { status: 502 });
  return NextResponse.json({ books: await response.json(), storage: "supabase" });
}

export async function POST(request: Request) {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return NextResponse.json({ storage: "local" });
  const session = await getAuthenticatedUser();
  if (!session) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  const { books } = await request.json();
  if (!Array.isArray(books)) return NextResponse.json({ error: "Books must be an array" }, { status: 400 });

  const lookup = await fetch(`${url}/rest/v1/books?select=isbn,title,author&user_id=eq.${session.user.id}`, { headers: supabaseHeaders(session.accessToken), cache: "no-store" });
  if (!lookup.ok) return NextResponse.json({ error: await supabaseError(lookup, "Could not check existing books") }, { status: 502 });
  const existing = await lookup.json();
  if (!Array.isArray(existing)) return NextResponse.json({ error: "Supabase returned an invalid duplicate-check response" }, { status: 502 });

  const unique = books.filter((book:any) => !existing.some((saved:any) =>
    book.isbn && saved.isbn
      ? clean(book.isbn) === clean(saved.isbn)
      : clean(book.title) === clean(saved.title) && clean(book.author) === clean(saved.author)
  )).map((book:any) => ({
    ...book,
    status: validStatus(book.status) ? book.status : "wishlist",
    id: crypto.randomUUID(),
    user_id: session.user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  let inserted:any[] = [];
  if (unique.length) {
    const response = await fetch(`${url}/rest/v1/books`, { method: "POST", headers: { ...supabaseHeaders(session.accessToken), Prefer: "return=representation" }, body: JSON.stringify(unique) });
    if (!response.ok) return NextResponse.json({ error: await supabaseError(response, "Could not save books") }, { status: 502 });
    inserted = await response.json();
  }
  return NextResponse.json({ books: inserted, skipped: books.length - unique.length, storage: "supabase" });
}
