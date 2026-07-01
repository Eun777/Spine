import type { Book, BookDraft } from "./types";

const KEY = "shelf-snap-books";

export function getLocalBooks(): Book[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function saveLocalBooks(drafts: BookDraft[]) {
  const current = getLocalBooks();
  const now = new Date().toISOString();
  const added: Book[] = [];
  const skipped: BookDraft[] = [];
  for (const draft of drafts) {
    const duplicate = current.some((book) =>
      draft.isbn && book.isbn
        ? clean(draft.isbn) === clean(book.isbn)
        : clean(draft.title) === clean(book.title) && clean(draft.author) === clean(book.author)
    );
    if (duplicate) { skipped.push(draft); continue; }
    added.push({ ...draft, status: draft.status || "wishlist", id: crypto.randomUUID(), cover_image_url: draft.cover_image_url || null, created_at: now, updated_at: now });
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

const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
