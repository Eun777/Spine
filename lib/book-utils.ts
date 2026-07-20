import {
  BOOK_STATUSES,
  DEFAULT_BOOK_STATUS,
  type Book,
  type BookDraft,
  type BookStatus,
} from "./types";

export function isBookStatus(value: unknown): value is BookStatus {
  return typeof value === "string" && BOOK_STATUSES.includes(value as BookStatus);
}

export function normalizeBookStatus(value: unknown): BookStatus {
  return isBookStatus(value) ? value : DEFAULT_BOOK_STATUS;
}

export function cleanBookKey(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function isDuplicateBook(candidate: Pick<BookDraft, "title" | "author" | "isbn">, saved: Pick<BookDraft, "title" | "author" | "isbn">) {
  if (candidate.isbn && saved.isbn) {
    return cleanBookKey(candidate.isbn) === cleanBookKey(saved.isbn);
  }

  return cleanBookKey(candidate.title) === cleanBookKey(saved.title) && cleanBookKey(candidate.author) === cleanBookKey(saved.author);
}

export function normalizeBookDraft(input: unknown): BookDraft | null {
  if (!input || typeof input !== "object") return null;
  const draft = input as Partial<BookDraft>;
  const title = String(draft.title || "").trim();
  if (!title) return null;

  return {
    title,
    author: String(draft.author || "Unknown author").trim() || "Unknown author",
    isbn: cleanNullableString(draft.isbn),
    genre: cleanNullableString(draft.genre),
    cover_image_url: cleanNullableString(draft.cover_image_url),
    confidence_score: typeof draft.confidence_score === "number" ? draft.confidence_score : null,
    description: cleanNullableString(draft.description),
    publisher: cleanNullableString(draft.publisher),
    published_date: cleanNullableString(draft.published_date),
    page_count: typeof draft.page_count === "number" ? draft.page_count : null,
    categories: Array.isArray(draft.categories) ? draft.categories.filter((category): category is string => typeof category === "string").slice(0, 12) : null,
    language: cleanNullableString(draft.language),
    google_books_id: cleanNullableString(draft.google_books_id),
    open_library_id: cleanNullableString(draft.open_library_id),
    preview_url: cleanNullableString(draft.preview_url),
    average_rating: typeof draft.average_rating === "number" ? draft.average_rating : null,
    ratings_count: typeof draft.ratings_count === "number" ? draft.ratings_count : null,
    metadata_source: draft.metadata_source === "google_books" || draft.metadata_source === "open_library" ? draft.metadata_source : null,
    status: normalizeBookStatus(draft.status),
  };
}

export function normalizeBook(input: unknown): Book | null {
  if (!input || typeof input !== "object") return null;
  const book = input as Partial<Book>;
  const draft = normalizeBookDraft(book);
  if (!draft || !book.id || !book.created_at || !book.updated_at) return null;

  return {
    ...draft,
    id: String(book.id),
    created_at: String(book.created_at),
    updated_at: String(book.updated_at),
  };
}

export function nlbSearchUrl(book: Pick<BookDraft, "title" | "author">) {
  return `https://search.nlb.gov.sg/onesearch/Search?${new URLSearchParams({
    query: `${book.title} ${book.author}`.trim(),
    cont: "book",
  })}`;
}

function cleanNullableString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}
