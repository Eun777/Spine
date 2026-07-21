import { isDuplicateBook, normalizeBook, normalizeBookDraft } from "./book-utils";
import type { Book, BookDraft } from "./types";

const KEY = "shelf-snap-books";

export function getLocalBooks(): Book[] {
  if (typeof window === "undefined") return [];
  try {
    const books = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(books) ? books.map(normalizeBook).filter((book): book is Book => Boolean(book)) : [];
  } catch {
    return [];
  }
}

export function saveLocalBooks(drafts: BookDraft[]) {
  const current = getLocalBooks();
  const now = new Date().toISOString();
  const added: Book[] = [];
  const skipped: BookDraft[] = [];
  const minSortOrder = Math.min(0, ...current.map((book) => book.sort_order ?? 0));
  const normalizedDrafts = drafts.map(normalizeBookDraft).filter((draft): draft is BookDraft => Boolean(draft));
  for (const [index, draft] of normalizedDrafts.entries()) {

    const duplicate = current.some((book) => isDuplicateBook(draft, book));
    if (duplicate) {
      skipped.push(draft);
      continue;
    }

    added.push({
      ...draft,
      id: crypto.randomUUID(),
      sort_order: minSortOrder - normalizedDrafts.length + index,
      created_at: now,
      updated_at: now,
    });
  }
  localStorage.setItem(KEY, JSON.stringify([...added, ...current]));
  return { added, skipped };
}

export function reorderLocalBooks(orderedIds: string[]) {
  const orderMap = new Map(orderedIds.map((id, index) => [id, index + 1]));
  const books = getLocalBooks()
    .map((book) => orderMap.has(book.id) ? { ...book, sort_order: orderMap.get(book.id)!, updated_at: new Date().toISOString() } : book)
    .sort(compareBooksByOrder);
  localStorage.setItem(KEY, JSON.stringify(books));
  return books;
}

export function updateLocalBook(id: string, updates: Partial<Book>) {
  const books = getLocalBooks().map((book) => book.id === id ? { ...book, ...updates, updated_at: new Date().toISOString() } : book);
  localStorage.setItem(KEY, JSON.stringify(books));
  return books;
}

export function deleteLocalBook(id: string) {
  const books = getLocalBooks().filter((book) => book.id !== id);
  localStorage.setItem(KEY, JSON.stringify(books));
  return books;
}

export function compareBooksByOrder(a: Book, b: Book) {
  const aOrder = typeof a.sort_order === "number" ? a.sort_order : Number.MAX_SAFE_INTEGER;
  const bOrder = typeof b.sort_order === "number" ? b.sort_order : Number.MAX_SAFE_INTEGER;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}
