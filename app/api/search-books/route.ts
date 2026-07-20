import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { mapOpenLibraryDoc, OPEN_LIBRARY_SEARCH_FIELDS, type OpenLibraryDoc } from "@/lib/open-library";
import { getAuthenticatedUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!await getAuthenticatedUser()) return apiError("Authentication required", { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 180) || "";
  if (query.length < 2) return apiError("Enter at least two characters", { status: 400 });

  const compact = query.replace(/[\s-]/g, "");
  const params = new URLSearchParams({
    fields: OPEN_LIBRARY_SEARCH_FIELDS,
    limit: "18",
  });

  if (/^(?:\d{9}[\dXx]|\d{13})$/.test(compact)) params.set("isbn", compact);
  else params.set("q", query);

  try {
    const response = await fetch(`https://openlibrary.org/search.json?${params}`, { next: { revalidate: 60 * 60 * 6 } });
    if (!response.ok) throw new Error("Open Library unavailable");

    const data = await response.json();
    const docs = Array.isArray(data.docs) ? data.docs as OpenLibraryDoc[] : [];
    const books = docs.map((doc) => mapOpenLibraryDoc(doc));

    return NextResponse.json({ books, total: data.numFound || books.length });
  } catch (error) {
    return apiError("Open Library is temporarily unavailable. Please try again.", { status: 502, cause: error });
  }
}
