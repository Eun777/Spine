"use client";

import { useCallback, useEffect, useState } from "react";
import { compareBooksByOrder, deleteLocalBook, getLocalBooks, reorderLocalBooks, updateLocalBook } from "@/lib/local-books";
import { BOOK_STATUS_LABELS, type Book, type BookStatus } from "@/lib/types";

type StorageMode = "local" | "supabase";

export function useLibraryBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [storage, setStorage] = useState<StorageMode>("local");
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch("/api/books")
      .then((response) => response.json())
      .then((data) => {
        if (data.storage === "supabase") {
          setStorage("supabase");
          setBooks((data.books || []).sort(compareBooksByOrder));
        } else {
          setBooks(getLocalBooks());
        }
      })
      .catch(() => setBooks(getLocalBooks()));
  }, []);

  const showToast = useCallback((message: string, duration = 2200) => {
    setToast(message);
    setTimeout(() => setToast(""), duration);
  }, []);

  async function removeBook(id: string) {
    if (storage === "supabase") {
      const response = await fetch(`/api/books/${id}`, { method: "DELETE" });
      if (!response.ok) {
        showToast("Could not remove that book");
        return;
      }
      setBooks((current) => current.filter((book) => book.id !== id));
    } else {
      setBooks(deleteLocalBook(id));
    }

    showToast("Book removed");
  }

  async function saveBookEdit(book: Book) {
    if (!book.title.trim()) return false;

    if (storage === "supabase") {
      const response = await fetch(`/api/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(book),
      });

      if (!response.ok) {
        showToast("Could not save changes");
        return false;
      }

      const data = await response.json();
      setBooks((current) => current.map((saved) => saved.id === book.id ? data.book : saved));
    } else {
      setBooks(updateLocalBook(book.id, book));
    }

    showToast("Changes saved");
    return true;
  }

  async function enrichBook(book: Book) {
    showToast("Looking up book details…", 2400);

    try {
      const response = await fetch("/api/book-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ books: [book] }),
      });
      if (!response.ok) throw new Error("Metadata lookup failed");

      const enriched = (await response.json()).books?.[0];
      if (!enriched?.metadata_source) {
        showToast("No additional details found", 2400);
        return;
      }

      if (storage === "supabase") {
        const saved = await fetch(`/api/books/${book.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(enriched),
        });
        if (!saved.ok) throw new Error("Book update failed");

        const data = await saved.json();
        setBooks((current) => current.map((savedBook) => savedBook.id === book.id ? data.book : savedBook));
      } else {
        setBooks(updateLocalBook(book.id, enriched));
      }

      showToast("Book details added", 2400);
    } catch {
      showToast("Could not find details right now", 2400);
    }
  }

  async function changeStatus(book: Book, status: BookStatus) {
    const previousStatus = book.status || "wishlist";
    setBooks((current) => current.map((saved) => saved.id === book.id ? { ...saved, status } : saved));

    try {
      if (storage === "supabase") {
        const response = await fetch(`/api/books/${book.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!response.ok) throw new Error("Status update failed");
      } else {
        setBooks(updateLocalBook(book.id, { status }));
      }

      showToast(`Moved to ${BOOK_STATUS_LABELS[status]}`);
    } catch {
      setBooks((current) => current.map((saved) => saved.id === book.id ? { ...saved, status: previousStatus } : saved));
      showToast("Could not update reading status");
    }
  }

  async function reorderBooks(nextBooks: Book[]) {
    const ordered = nextBooks.map((book, index) => ({ ...book, sort_order: index + 1 }));
    const previous = books;
    setBooks(ordered);

    try {
      if (storage === "supabase") {
        const response = await fetch("/api/books/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds: ordered.map((book) => book.id) }),
        });
        if (!response.ok) throw new Error("Could not save book order");
      } else {
        setBooks(reorderLocalBooks(ordered.map((book) => book.id)));
      }

      showToast("Book order updated");
    } catch {
      setBooks(previous);
      showToast("Could not update book order");
    }
  }

  return {
    books,
    toast,
    showToast,
    removeBook,
    saveBookEdit,
    enrichBook,
    changeStatus,
    reorderBooks,
  };
}
