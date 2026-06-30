import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import type { BookDraft } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!await getAuthenticatedUser()) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 180) || "";
  if (query.length < 2) return NextResponse.json({ error: "Enter at least two characters" }, { status: 400 });

  const compact = query.replace(/[\s-]/g, "");
  const params = new URLSearchParams({
    fields: "key,title,author_name,isbn,cover_i,first_publish_year,publisher,subject,language,number_of_pages_median,ratings_average,ratings_count",
    limit: "18",
  });
  if (/^(?:\d{9}[\dXx]|\d{13})$/.test(compact)) params.set("isbn", compact);
  else params.set("q", query);

  try {
    const response = await fetch(`https://openlibrary.org/search.json?${params}`, { next: { revalidate: 60 * 60 * 6 } });
    if (!response.ok) throw new Error("Open Library unavailable");
    const data = await response.json();
    const books: BookDraft[] = (data.docs || []).map((doc:any) => ({
      title: doc.title || "Untitled",
      author: doc.author_name?.[0] || "Unknown author",
      isbn: doc.isbn?.find((value:string)=>value.replace(/[^0-9X]/gi,"").length===13) || doc.isbn?.[0] || null,
      genre: doc.subject?.[0] || null,
      confidence_score: null,
      cover_image_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      publisher: doc.publisher?.[0] || null,
      published_date: doc.first_publish_year ? String(doc.first_publish_year) : null,
      page_count: doc.number_of_pages_median || null,
      categories: doc.subject?.slice(0,8) || null,
      language: doc.language?.[0] || null,
      open_library_id: String(doc.key || "").replace("/works/", "") || null,
      preview_url: doc.key ? `https://openlibrary.org${doc.key}` : null,
      average_rating: doc.ratings_average || null,
      ratings_count: doc.ratings_count || null,
      metadata_source: "open_library" as const,
    }));
    return NextResponse.json({ books, total: data.numFound || books.length });
  } catch {
    return NextResponse.json({ error: "Open Library is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
