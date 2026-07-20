import { NextResponse } from "next/server";
import { apiError, readJson } from "@/lib/api-response";
import { cleanBookKey, normalizeBookDraft } from "@/lib/book-utils";
import { findBestOpenLibraryMatch, mapOpenLibraryDoc, OPEN_LIBRARY_SEARCH_FIELDS, type OpenLibraryDoc } from "@/lib/open-library";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import type { BookDraft } from "@/lib/types";

export const dynamic = "force-dynamic";

type Enrichment = Partial<BookDraft>;
const cache = new Map<string, Enrichment>();
const secureImage = (url?: string) => url ? url.replace(/^http:/, "https:") : null;

function googleScore(item: any, book: BookDraft) {
  const info = item.volumeInfo || {};
  const ids = (info.industryIdentifiers || []).map((id:any)=>cleanBookKey(id.identifier));
  if (book.isbn && ids.includes(cleanBookKey(book.isbn))) return 100;
  let score = cleanBookKey(info.title) === cleanBookKey(book.title) ? 50 : cleanBookKey(info.title).includes(cleanBookKey(book.title)) ? 25 : 0;
  if (book.author && (info.authors || []).some((author:string)=>cleanBookKey(author).includes(cleanBookKey(book.author)) || cleanBookKey(book.author).includes(cleanBookKey(author)))) score += 30;
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
    fields: OPEN_LIBRARY_SEARCH_FIELDS,
    limit: "5",
  });
  if (book.isbn) params.set("isbn", book.isbn);
  else { params.set("title", book.title.slice(0,180)); if (book.author) params.set("author", book.author.slice(0,120)); }
  const response = await fetch(`https://openlibrary.org/search.json?${params}`, { next: { revalidate: 60 * 60 * 24 * 7 } });
  if (!response.ok) return null;
  const data = await response.json();
  const docs = Array.isArray(data.docs) ? data.docs as OpenLibraryDoc[] : [];
  const match = findBestOpenLibraryMatch(docs, book);
  if (!match) return null;
  return mapOpenLibraryDoc(match, book);
}

async function enrich(book: BookDraft) {
  const cacheKey = book.isbn ? `isbn:${cleanBookKey(book.isbn)}` : `book:${cleanBookKey(book.title)}:${cleanBookKey(book.author)}`;
  if (cache.has(cacheKey)) return { ...book, ...cache.get(cacheKey), genre: book.genre || cache.get(cacheKey)?.genre || null };
  const metadata = await fromGoogle(book).catch(()=>null) || await fromOpenLibrary(book).catch(()=>null) || {};
  cache.set(cacheKey, metadata);
  return { ...book, ...metadata, genre: book.genre || metadata.genre || null };
}

export async function POST(request: Request) {
  if (!await getAuthenticatedUser()) return apiError("Authentication required", { status: 401 });

  const body = await readJson(request);
  const books = body && typeof body === "object" && "books" in body ? (body as { books?: unknown }).books : null;
  if (!Array.isArray(books) || books.length > 20) return apiError("Provide up to 20 books", { status: 400 });

  const normalizedBooks = books.map(normalizeBookDraft).filter((book): book is BookDraft => Boolean(book));
  if (!normalizedBooks.length) return apiError("At least one book with a title is required", { status: 400 });

  const enriched: BookDraft[] = [];
  for (let index=0; index<normalizedBooks.length; index++) {
    enriched.push(await enrich(normalizedBooks[index]));
    if (!process.env.GOOGLE_BOOKS_API_KEY && index < normalizedBooks.length - 1) await new Promise(resolve=>setTimeout(resolve,1050));
  }

  return NextResponse.json({ books: enriched });
}
