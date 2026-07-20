"use client";

import { nlbSearchUrl } from "@/lib/book-utils";
import {
  BOOK_STATUSES,
  BOOK_STATUS_LABELS,
  type Book,
  type BookStatus,
} from "@/lib/types";

type BookCardProps = {
  book: Book;
  onEdit: () => void;
  onDelete: () => void;
  onEnrich: () => void;
  onStatusChange: (status: BookStatus) => void;
};

export default function BookCard({
  book,
  onEdit,
  onDelete,
  onEnrich,
  onStatusChange,
}: BookCardProps) {
  const nlbUrl = nlbSearchUrl(book);
  const facts = [
    book.published_date,
    book.page_count ? `${book.page_count} pages` : null,
    book.language?.toUpperCase(),
  ].filter(Boolean);

  return (
    <article className={`book-card ${book.cover_image_url ? "has-cover" : ""}`}>
      <div className="card-labels">
        <span className="genre">{book.genre || book.categories?.[0] || "Unclassified"}</span>
        <label className={`status-control status-${book.status || "wishlist"}`}>
          <span className="sr-only">Reading status</span>
          <select
            aria-label={`Status for ${book.title}`}
            value={book.status || "wishlist"}
            onChange={(event) => onStatusChange(event.target.value as BookStatus)}
          >
            {BOOK_STATUSES.map((status) => (
              <option value={status} key={status}>
                {BOOK_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card-actions">
        <button className="icon-btn" aria-label={`Edit ${book.title}`} onClick={onEdit}>
          ✎
        </button>
        <button className="icon-btn" aria-label={`Delete ${book.title}`} onClick={onDelete}>
          ⌫
        </button>
      </div>

      {book.cover_image_url && (
        <img className="book-cover" src={book.cover_image_url} alt={`Cover of ${book.title}`} />
      )}

      <h2>{book.title}</h2>
      <p className="author">by {book.author || "Unknown author"}</p>

      {book.description && <p className="book-description">{book.description}</p>}
      {facts.length > 0 && <p className="book-facts">{facts.join(" · ")}</p>}
      {book.average_rating && (
        <p className="book-rating">
          <span>★</span> {book.average_rating.toFixed(1)}
          {book.ratings_count ? ` (${book.ratings_count.toLocaleString()})` : ""}
        </p>
      )}
      {book.isbn && <span className="isbn">ISBN {book.isbn}</span>}

      <div className="book-links">
        {book.preview_url ? (
          <a href={book.preview_url} target="_blank" rel="noopener noreferrer">
            Book details ↗
          </a>
        ) : (
          <button onClick={onEnrich}>Add details ＋</button>
        )}
        <a href={nlbUrl} target="_blank" rel="noopener noreferrer">
          Find at NLB ↗
        </a>
      </div>
    </article>
  );
}
