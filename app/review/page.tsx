"use client";

import { saveLocalBooks } from "@/lib/local-books";
import {
  BOOK_STATUSES,
  BOOK_STATUS_LABELS,
  type BookDraft,
  type BookStatus,
} from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ReviewPage() {
  const router = useRouter();
  const [books, setBooks] = useState<BookDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Read books from sessionStorage safely on mount
  useEffect(() => {
    try {
      const rawData = sessionStorage.getItem("detected-books");
      if (rawData) {
        const parsed = JSON.parse(rawData);
        if (Array.isArray(parsed)) {
          setBooks(
            parsed.map((book: BookDraft) => ({
              ...book,
              status: book.status || "wishlist",
            }))
          );
        }
      }
    } catch (err) {
      console.error("Failed to parse detected books from session storage:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleUpdateBook = (
    index: number,
    key: keyof BookDraft,
    value: string
  ) => {
    setBooks((prev) =>
      prev.map((book, i) => (i === index ? { ...book, [key]: value } : book))
    );
    // Clear validation error when user edits the field
    setValidationErrors((prev) => {
      const updated = new Set(prev);
      updated.delete(index);
      return updated;
    });
  };

  const handleRemoveBook = (index: number) => {
    setBooks((prev) => prev.filter((_, i) => i !== index));
    setValidationErrors((prev) => {
      const updated = new Set(prev);
      updated.delete(index);
      return updated;
    });
  };

  const handleSave = async () => {
    // Validate required fields
    const invalidIndices = new Set<number>();
    books.forEach((book, index) => {
      if (!book.title.trim()) {
        invalidIndices.add(index);
      }
    });

    if (invalidIndices.size > 0) {
      setValidationErrors(invalidIndices);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ books }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not save books.");
      }

      sessionStorage.removeItem("detected-books");

      if (data.storage === "supabase") {
        const savedCount = data.books?.length || 0;
        const skippedCount = data.skipped || 0;
        router.push(`/?saved=${savedCount}&skipped=${skippedCount}`);
        return;
      }

      // Fallback to local storage
      const result = saveLocalBooks(books);
      router.push(`/?saved=${result.added.length}&skipped=${result.skipped.length}`);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Could not save books. Your review has been kept."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="shell review-shell">
        <p>Loading your scanned books...</p>
      </section>
    );
  }

  return (
    <section className="shell review-shell">
      <header className="review-top">
        <div>
          <p className="eyebrow">Almost there</p>
          <h1>Review your books</h1>
          <p className="lede">
            We found {books.length} {books.length === 1 ? "book" : "books"}. Give the details a quick look before saving.
          </p>
        </div>
      </header>

      {books.length === 0 ? (
        <div className="empty">
          <h2>No books to review</h2>
          <p>Head back and scan a photo first.</p>
          <button className="primary" onClick={() => router.push("/scan")}>
            Scan books
          </button>
        </div>
      ) : (
        <>
          <div className="detected-list">
            {books.map((book, index) => (
              <BookReviewCard
                // Fallback to title+index to ensure a stable React key when items are removed
                key={book.isbn || `${book.title}-${index}`}
                book={book}
                index={index}
                hasError={validationErrors.has(index)}
                onUpdate={handleUpdateBook}
                onRemove={handleRemoveBook}
              />
            ))}
          </div>

          {saveError && (
            <p className="form-error save-error" role="alert">
              {saveError}
            </p>
          )}

          <footer className="review-actions">
            <p>{books.length} selected · You can edit these later</p>
            <button
              className="primary"
              disabled={isSaving || books.length === 0}
              onClick={handleSave}
            >
              {isSaving ? "Saving…" : `Save ${books.length} ${books.length === 1 ? "book" : "books"}`}
            </button>
          </footer>
        </>
      )}
    </section>
  );
}

// Sub-component for individual book card rendering
interface BookReviewCardProps {
  book: BookDraft;
  index: number;
  hasError: boolean;
  onUpdate: (index: number, key: keyof BookDraft, value: string) => void;
  onRemove: (index: number) => void;
}

function BookReviewCard({
  book,
  index,
  hasError,
  onUpdate,
  onRemove,
}: BookReviewCardProps) {
  const matchPercentage = Math.round((book.confidence_score || 0) * 100);

  return (
    <article className="detected">
      <div className="detected-head">
        <span className="confidence">{matchPercentage}% match</span>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Remove ${book.title || "book"}`}
          onClick={() => onRemove(index)}
        >
          Remove ✕
        </button>
      </div>

      {(book.cover_image_url || book.description) && (
        <div className="metadata-preview">
          {book.cover_image_url && (
            <img src={book.cover_image_url} alt={`Cover for ${book.title || "book"}`} />
          )}
          <div>
            <strong>
              {book.metadata_source === "google_books"
                ? "Matched with Google Books"
                : "Matched with Open Library"}
            </strong>
            {book.description && <p>{book.description}</p>}
            {(book.publisher || book.published_date) && (
              <small>
                {[book.publisher, book.published_date].filter(Boolean).join(" · ")}
              </small>
            )}
          </div>
        </div>
      )}

      <div className="form-grid">
        <label>
          Title *
          <input
            className={hasError ? "error-input" : ""}
            value={book.title}
            onChange={(e) => onUpdate(index, "title", e.target.value)}
          />
          {hasError && <span className="error-text">A title is required</span>}
        </label>

        <label>
          Author
          <input
            value={book.author}
            onChange={(e) => onUpdate(index, "author", e.target.value)}
          />
        </label>

        <label>
          ISBN
          <input
            inputMode="numeric"
            value={book.isbn || ""}
            onChange={(e) => onUpdate(index, "isbn", e.target.value)}
          />
        </label>

        <label>
          Genre
          <input
            value={book.genre || ""}
            onChange={(e) => onUpdate(index, "genre", e.target.value)}
          />
        </label>

        <label>
          Collection status
          <select
            value={book.status || "wishlist"}
            onChange={(e) => onUpdate(index, "status", e.target.value as BookStatus)}
          >
            {BOOK_STATUSES.map((status) => (
              <option value={status} key={status}>
                {BOOK_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}