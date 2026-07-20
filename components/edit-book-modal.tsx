"use client";

import {
  BOOK_STATUSES,
  BOOK_STATUS_LABELS,
  type Book,
  type BookStatus,
} from "@/lib/types";

type EditBookModalProps = {
  book: Book;
  onChange: (book: Book) => void;
  onClose: () => void;
  onSave: () => void;
};

const EDITABLE_TEXT_FIELDS = ["title", "author", "isbn", "genre"] as const;

export default function EditBookModal({
  book,
  onChange,
  onClose,
  onSave,
}: EditBookModalProps) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Edit book">
        <h2>Edit book</h2>
        <div className="form-grid">
          {EDITABLE_TEXT_FIELDS.map((field) => (
            <label key={field}>
              {field.toUpperCase()}
              <input
                value={book[field] || ""}
                onChange={(event) => onChange({ ...book, [field]: event.target.value })}
              />
            </label>
          ))}

          <label>
            STATUS
            <select
              value={book.status || "wishlist"}
              onChange={(event) => onChange({ ...book, status: event.target.value as BookStatus })}
            >
              {BOOK_STATUSES.map((status) => (
                <option value={status} key={status}>
                  {BOOK_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" onClick={onSave}>
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
