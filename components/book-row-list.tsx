"use client";

import type { Book } from "@/lib/types";

type BookRowListProps = {
  books: Book[];
  onMove: (fromIndex: number, toIndex: number) => void;
};

const dateFormat = new Intl.DateTimeFormat("en-SG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default function BookRowList({ books, onMove }: BookRowListProps) {
  return (
    <div className="book-row-list" role="table" aria-label="Books in row view">
      <div className="book-row book-row-heading" role="row">
        <span role="columnheader">Title</span>
        <span role="columnheader">Author</span>
        <span role="columnheader">ISBN</span>
        <span role="columnheader">Date added</span>
        <span role="columnheader">Order</span>
      </div>

      {books.map((book, index) => (
        <article className="book-row" role="row" key={book.id}>
          <span role="cell" className="book-row-title">{book.title}</span>
          <span role="cell">{book.author || "Unknown author"}</span>
          <span role="cell">{book.isbn || "—"}</span>
          <span role="cell">{dateFormat.format(new Date(book.created_at))}</span>
          <span role="cell" className="book-row-actions">
            <button
              className="icon-btn"
              disabled={index === 0}
              aria-label={`Move ${book.title} up`}
              onClick={() => onMove(index, index - 1)}
            >
              ↑
            </button>
            <button
              className="icon-btn"
              disabled={index === books.length - 1}
              aria-label={`Move ${book.title} down`}
              onClick={() => onMove(index, index + 1)}
            >
              ↓
            </button>
          </span>
        </article>
      ))}
    </div>
  );
}
