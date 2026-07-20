"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import BookCard from "@/components/book-card";
import EditBookModal from "@/components/edit-book-modal";
import WishlistReceiptModal from "@/components/wishlist-receipt-modal";
import { useLibraryBooks } from "@/hooks/use-library-books";
import {
  BOOK_STATUSES,
  BOOK_STATUS_LABELS,
  type Book,
} from "@/lib/types";

const ALL_GENRES = "All genres";
const ALL_STATUSES = "All statuses";

export default function HomePage() {
  const {
    books,
    toast,
    showToast,
    removeBook,
    saveBookEdit,
    enrichBook,
    changeStatus,
  } = useLibraryBooks();
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState(ALL_GENRES);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [editing, setEditing] = useState<Book | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptName, setReceiptName] = useState("");

  const genres = useMemo(
    () => [
      ALL_GENRES,
      ...Array.from(new Set(books.map((book) => book.genre).filter(Boolean) as string[])).sort(),
    ],
    [books]
  );

  const shown = useMemo(() => {
    const normalizedQuery = query.toLowerCase();

    return books.filter((book) => {
      const matchesQuery =
        !normalizedQuery ||
        [book.title, book.author, book.genre || ""].some((value) =>
          value.toLowerCase().includes(normalizedQuery)
        );
      const matchesGenre = genre === ALL_GENRES || book.genre === genre;
      const matchesStatus = statusFilter === ALL_STATUSES || (book.status || "wishlist") === statusFilter;

      return matchesQuery && matchesGenre && matchesStatus;
    });
  }, [books, genre, query, statusFilter]);

  const wishlist = useMemo(
    () => books.filter((book) => (book.status || "wishlist") === "wishlist"),
    [books]
  );

  async function handleDelete(book: Book) {
    if (!confirm("Remove this book from your library?")) return;
    await removeBook(book.id);
  }

  async function handleSaveEdit() {
    if (!editing) return;
    const saved = await saveBookEdit(editing);
    if (saved) setEditing(null);
  }

  function clearFilters() {
    setQuery("");
    setGenre(ALL_GENRES);
    setStatusFilter(ALL_STATUSES);
  }

  return (
    <section className="shell">
      <div className="library-head">
        <div>
          <p className="eyebrow">Your personal collection</p>
          <h1>My library</h1>
          <p className="lede">Every shelf tells a story. Keep yours close.</p>
        </div>
        <div className="library-summary">
          {wishlist.length > 0 && (
            <button className="receipt-button" onClick={() => setShowReceipt(true)}>
              ▤ Share wishlist
            </button>
          )}
          <span className="collection-count">
            {books.length} {books.length === 1 ? "book" : "books"}
          </span>
        </div>
      </div>

      {books.length > 0 && (
        <LibraryFilters
          query={query}
          genre={genre}
          genres={genres}
          statusFilter={statusFilter}
          onQueryChange={setQuery}
          onGenreChange={setGenre}
          onStatusFilterChange={setStatusFilter}
        />
      )}

      {books.length === 0 ? (
        <EmptyLibrary />
      ) : shown.length === 0 ? (
        <NoResults onClear={clearFilters} />
      ) : (
        <div className="book-grid">
          {shown.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onEdit={() => setEditing(book)}
              onDelete={() => handleDelete(book)}
              onEnrich={() => enrichBook(book)}
              onStatusChange={(status) => changeStatus(book, status)}
            />
          ))}
        </div>
      )}

      {editing && (
        <EditBookModal
          book={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={handleSaveEdit}
        />
      )}

      {showReceipt && (
        <WishlistReceiptModal
          books={wishlist}
          owner={receiptName}
          onOwnerChange={setReceiptName}
          onClose={() => setShowReceipt(false)}
          onToast={showToast}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </section>
  );
}

type LibraryFiltersProps = {
  query: string;
  genre: string;
  genres: string[];
  statusFilter: string;
  onQueryChange: (query: string) => void;
  onGenreChange: (genre: string) => void;
  onStatusFilterChange: (status: string) => void;
};

function LibraryFilters({
  query,
  genre,
  genres,
  statusFilter,
  onQueryChange,
  onGenreChange,
  onStatusFilterChange,
}: LibraryFiltersProps) {
  return (
    <div className="tools">
      <label className="field-shell">
        <span aria-hidden="true">⌕</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search title, author, or genre…"
          aria-label="Search books"
        />
      </label>

      <label className="field-shell">
        <select value={genre} onChange={(event) => onGenreChange(event.target.value)} aria-label="Filter by genre">
          {genres.map((availableGenre) => (
            <option key={availableGenre}>{availableGenre}</option>
          ))}
        </select>
      </label>

      <label className="field-shell">
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
          aria-label="Filter by reading status"
        >
          <option>{ALL_STATUSES}</option>
          {BOOK_STATUSES.map((status) => (
            <option value={status} key={status}>
              {BOOK_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function EmptyLibrary() {
  return (
    <div className="empty">
      <div className="empty-icon">⌁</div>
      <h2>Your shelves are waiting</h2>
      <p>Scan a cover or a whole stack to begin your collection.</p>
      <Link className="primary" href="/scan">
        Scan your first books
      </Link>
    </div>
  );
}

function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="empty">
      <h2>No matching books</h2>
      <p>Try a different search, genre, or status.</p>
      <button className="secondary" onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
}
