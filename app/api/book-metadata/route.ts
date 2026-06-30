import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import type { BookDraft } from "@/lib/types";

export const dynamic = "force-dynamic";

type Enrichment = Partial<BookDraft>;
const cache = new Map<string, Enrichment>();
const clean = (value: string | null | undefined) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const secureImage = (url?: string) => url ? url.replace(/^http:/, "https:") : null;

function googleScore(item: any, book: BookDraft) {
  const info = item.volumeInfo || {};
  const ids = (info.industryIdentifiers || []).map((id:any)=>clean(id.identifier));
  if (book.isbn && ids.includes(clean(book.isbn))) return 100;
  let score = clean(info.title) === clean(book.title) ? 50 : clean(info.title).includes(clean(book.title)) ? 25 : 0;
  if (book.author && (info.authors || []).some((author:string)=>clean(author).includes(clean(book.author)) || clean(book.author).includes(clean(author)))) score += 30;
  return score;
}

async function fromGoogle(book: BookDraft): Promise<Enrichment | null> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) return null;
  const query = book.isbn ? `isbn:${book.isbn}` : `intitle:"${book.title.slice(0,180)}"${book.author ? ` inauthor:"${book.author.slice(0,120)}"` : ""}`;
  const params = new URLSearchParams({ q: query, maxResults: "5", printType: "books", projection: "full", key });
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, { next: { revalidate: 60 * 60 * 24 * 7 } });
  if (!response.ok) return null;
  const data = await response.json();
  const items = Array.isArray(data.items) ? data.items : [];
  const match = items.map((item:any)=>({item,score:googleScore(item,book)})).sort((a:any,b:any)=>b.score-a.score)[0];
  if (!match || match.score < 25) return null;
  const info = match.item.volumeInfo || {};
  const isbn = (info.industryIdentifiers || []).find((id:any)=>id.type === "ISBN_13")?.identifier || (info.industryIdentifiers || []).find((id:any)=>id.type === "ISBN_10")?.identifier || book.isbn;
  return {
    isbn, description: info.description || null, publisher: info.publisher || null,
    published_date: info.publishedDate || null, page_count: info.pageCount || null,
    categories: info.categories || null, genre: book.genre || info.categories?.[0] || null,
    language: info.language || null, cover_image_url: secureImage(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail),
    google_books_id: match.item.id, preview_url: info.previewLink || info.infoLink || null,
    average_rating: info.averageRating || null, ratings_count: info.ratingsCount || null,
    metadata_source: "google_books",
  };
}

async function fromOpenLibrary(book: BookDraft): Promise<Enrichment | null> {
  const params = new URLSearchParams({
    fields: "key,title,author_name,isbn,cover_i,first_publish_year,publisher,subject,language,number_of_pages_median,ratings_average,ratings_count",
    limit: "5",
  });
  if (book.isbn) params.set("isbn", book.isbn);
  else { params.set("title", book.title.slice(0,180)); if (book.author) params.set("author", book.author.slice(0,120)); }
  const response = await fetch(`https://openlibrary.org/search.json?${params}`, { next: { revalidate: 60 * 60 * 24 * 7 } });
  if (!response.ok) return null;
  const data = await response.json();
  const docs = Array.isArray(data.docs) ? data.docs : [];
  const match = docs.find((doc:any)=>book.isbn && (doc.isbn || []).some((value:string)=>clean(value)===clean(book.isbn))) || docs.find((doc:any)=>clean(doc.title)===clean(book.title)) || docs[0];
  if (!match) return null;
  return {
    isbn: book.isbn || match.isbn?.find((value:string)=>clean(value).length===13) || match.isbn?.[0] || null,
    publisher: match.publisher?.[0] || null, published_date: match.first_publish_year ? String(match.first_publish_year) : null,
    page_count: match.number_of_pages_median || null, categories: match.subject?.slice(0,8) || null,
    genre: book.genre || match.subject?.[0] || null, language: match.language?.[0] || null,
    cover_image_url: match.cover_i ? `https://covers.openlibrary.org/b/id/${match.cover_i}-L.jpg` : null,
    open_library_id: String(match.key || "").replace("/works/", "") || null,
    preview_url: match.key ? `https://openlibrary.org${match.key}` : null,
    average_rating: match.ratings_average || null, ratings_count: match.ratings_count || null,
    metadata_source: "open_library",
  };
}

async function enrich(book: BookDraft) {
  const cacheKey = book.isbn ? `isbn:${clean(book.isbn)}` : `book:${clean(book.title)}:${clean(book.author)}`;
  if (cache.has(cacheKey)) return { ...book, ...cache.get(cacheKey), genre: book.genre || cache.get(cacheKey)?.genre || null };
  const metadata = await fromGoogle(book).catch(()=>null) || await fromOpenLibrary(book).catch(()=>null) || {};
  cache.set(cacheKey, metadata);
  return { ...book, ...metadata, genre: book.genre || metadata.genre || null };
}

export async function POST(request: Request) {
  if (!await getAuthenticatedUser()) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { books } = await request.json();
  if (!Array.isArray(books) || books.length > 20) return NextResponse.json({ error: "Provide up to 20 books" }, { status: 400 });
  const enriched: BookDraft[] = [];
  for (let index=0; index<books.length; index++) {
    enriched.push(await enrich(books[index]));
    if (!process.env.GOOGLE_BOOKS_API_KEY && index < books.length - 1) await new Promise(resolve=>setTimeout(resolve,1050));
  }
  return NextResponse.json({ books: enriched });
}
