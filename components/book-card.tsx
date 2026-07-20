"use client";

import { nlbSearchUrl } from "@/lib/book-utils";
import {
  BOOK_STATUSES,
  BOOK_STATUS_LABELS,
  type Book,
  type BookStatus,
} from "@/lib/types";
import type { CachedNlbAvailability } from "@/hooks/use-nlb-availability";

type BookCardProps = {
  book: Book;
  availability?: CachedNlbAvailability;
  isAvailabilityLoading?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onEnrich: () => void;
  onStatusChange: (status: BookStatus) => void;
};

export default function BookCard({
  book,
  availability,
  isAvailabilityLoading = false,
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

      <NlbAvailabilityPanel availability={availability} isLoading={isAvailabilityLoading} />

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

function NlbAvailabilityPanel({
  availability,
  isLoading,
}: {
  availability?: CachedNlbAvailability;
  isLoading: boolean;
}) {
  if (isLoading && !availability) {
    return <p className="nlb-availability muted">Checking NLB availability…</p>;
  }

  if (!availability) {
    return <p className="nlb-availability muted">NLB availability not checked yet</p>;
  }

  if (!availability.matched) {
    return (
      <p className="nlb-availability unavailable">
        {availability.error || "NLB match not confirmed"}
      </p>
    );
  }

  const availableBranches = availability.items.filter((item) => item.isAvailable);
  const branchPreview = availableBranches.slice(0, 3);
  const checkedTime = new Intl.DateTimeFormat("en-SG", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(availability.checkedAt));

  return (
    <div className={`nlb-availability ${availability.availableItems > 0 ? "available" : "unavailable"}`}>
      <div className="nlb-availability-head">
        <span>
          {availability.availableItems > 0
            ? `Available at ${availableBranches.length} ${availableBranches.length === 1 ? "library" : "libraries"}`
            : "No available copies found"}
        </span>
        {isLoading && <small>Refreshing…</small>}
      </div>

      {branchPreview.length > 0 ? (
        <ul>
          {branchPreview.map((item) => (
            <li key={`${item.itemId}-${item.branchCode}`}>
              {item.branchName}
              {item.callNumber ? <small>{item.callNumber}</small> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>{availability.totalItems > 0 ? `${availability.totalItems} copies are currently on loan or unavailable.` : "No NLB copies found for this match."}</p>
      )}

      <small>Checked {checkedTime}</small>
    </div>
  );
}
