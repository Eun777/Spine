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
  for (const draftInput of drafts) {
    const draft = normalizeBookDraft(draftInput);
    if (!draft) continue;

    const duplicate = current.some((book) => isDuplicateBook(draft, book));
    if (duplicate) {
      skipped.push(draft);
      continue;
    }

    added.push({
      ...draft,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    });
  }
  localStorage.setItem(KEY, JSON.stringify([...added, ...current]));
  return { added, skipped };
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
