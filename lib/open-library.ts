import { cleanBookKey } from "./book-utils";
import type { BookDraft } from "./types";

export type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  first_publish_year?: number;
  publisher?: string[];
  subject?: string[];
  language?: string[];
  number_of_pages_median?: number;
  ratings_average?: number;
  ratings_count?: number;
};

export const OPEN_LIBRARY_SEARCH_FIELDS = [
  "key",
  "title",
  "author_name",
  "isbn",
  "cover_i",
  "first_publish_year",
  "publisher",
  "subject",
  "language",
  "number_of_pages_median",
  "ratings_average",
  "ratings_count",
].join(",");

export function mapOpenLibraryDoc(doc: OpenLibraryDoc, fallback: Partial<BookDraft> = {}): BookDraft {
  return {
    title: doc.title || fallback.title || "Untitled",
    author: doc.author_name?.[0] || fallback.author || "Unknown author",
    isbn: fallback.isbn || doc.isbn?.find((value) => cleanBookKey(value).length === 13) || doc.isbn?.[0] || null,
    genre: fallback.genre || doc.subject?.[0] || null,
    confidence_score: fallback.confidence_score ?? null,
    cover_image_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : fallback.cover_image_url || null,
    description: fallback.description || null,
    publisher: doc.publisher?.[0] || fallback.publisher || null,
    published_date: doc.first_publish_year ? String(doc.first_publish_year) : fallback.published_date || null,
    page_count: doc.number_of_pages_median || fallback.page_count || null,
    categories: doc.subject?.slice(0, 8) || fallback.categories || null,
    language: doc.language?.[0] || fallback.language || null,
    google_books_id: fallback.google_books_id || null,
    open_library_id: String(doc.key || "").replace("/works/", "") || fallback.open_library_id || null,
    preview_url: doc.key ? `https://openlibrary.org${doc.key}` : fallback.preview_url || null,
    average_rating: doc.ratings_average || fallback.average_rating || null,
    ratings_count: doc.ratings_count || fallback.ratings_count || null,
    metadata_source: "open_library",
    status: fallback.status,
  };
}

export function findBestOpenLibraryMatch(docs: OpenLibraryDoc[], book: BookDraft) {
  return (
    docs.find((doc) => book.isbn && (doc.isbn || []).some((value) => cleanBookKey(value) === cleanBookKey(book.isbn))) ||
    docs.find((doc) => cleanBookKey(doc.title) === cleanBookKey(book.title)) ||
    docs[0] ||
    null
  );
}
