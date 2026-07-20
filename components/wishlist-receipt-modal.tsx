"use client";

import { useState } from "react";
import { makeReceiptImage, receiptText } from "@/lib/receipt";
import type { Book } from "@/lib/types";

type WishlistReceiptModalProps = {
  books: Book[];
  owner: string;
  onOwnerChange: (owner: string) => void;
  onClose: () => void;
  onToast: (message: string, duration?: number) => void;
};

const receiptDateFormat = new Intl.DateTimeFormat("en-SG", { dateStyle: "long" });

export default function WishlistReceiptModal({
  books,
  owner,
  onOwnerChange,
  onClose,
  onToast,
}: WishlistReceiptModalProps) {
  const [isSharing, setIsSharing] = useState(false);
  const trimmedOwner = owner.trim();

  async function shareReceipt() {
    setIsSharing(true);
    try {
      const blob = await makeReceiptImage(books, trimmedOwner);
      const file = new File([blob], "book-wishlist-receipt.png", { type: "image/png" });
      const shareData = {
        title: "My book wishlist",
        text: receiptText(books, trimmedOwner),
        files: [file],
      };

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share(shareData);
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(url);
        onToast("Receipt image saved — attach it to your message");
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        onToast("Could not share the receipt");
      }
    } finally {
      setIsSharing(false);
    }
  }

  async function copyReceipt() {
    try {
      await navigator.clipboard.writeText(receiptText(books, trimmedOwner));
      onToast("Wishlist copied — paste it into any chat", 2400);
    } catch {
      onToast("Could not copy the wishlist", 2400);
    }
  }

  return (
    <div
      className="modal-backdrop receipt-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="receipt-dialog" role="dialog" aria-modal="true" aria-label="Share book wishlist">
        <div className="receipt-controls">
          <div>
            <p className="eyebrow">Ready to gift</p>
            <h2>Share your wishlist</h2>
          </div>
          <button className="icon-btn close-receipt" aria-label="Close" onClick={onClose}>
            ✕
          </button>
          <label>
            Your name (optional)
            <input
              value={owner}
              onChange={(event) => onOwnerChange(event.target.value)}
              placeholder="e.g. Jamie"
              maxLength={40}
            />
          </label>
        </div>

        <div className="receipt-paper">
          <h3>SPINE</h3>
          <p className="receipt-subtitle">BOOK WISHLIST</p>
          <div className="receipt-meta">
            <span>{trimmedOwner ? `FOR ${trimmedOwner.toUpperCase()}` : "A VERY BOOKISH WISHLIST"}</span>
            <span>{receiptDateFormat.format(new Date()).toUpperCase()}</span>
          </div>
          <div className="receipt-rule" />
          <div className="receipt-row receipt-heading">
            <span>QTY</span>
            <span>ITEM</span>
          </div>

          {books.map((book, index) => (
            <div className="receipt-row receipt-item" key={book.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span>
                <strong>{book.title}</strong>
                <small>{book.author || "Unknown author"}</small>
              </span>
            </div>
          ))}

          <div className="receipt-rule" />
          <div className="receipt-total">
            <span>ITEM COUNT:</span>
            <strong>{books.length}</strong>
          </div>
          <div className="receipt-rule" />
          <p className="receipt-thanks">THANK YOU FOR FEEDING MY TBR!</p>
          <div className="receipt-barcode" aria-hidden="true" />
          <p className="receipt-brand">spine · my book wishlist</p>
        </div>

        <div className="receipt-actions">
          <button className="secondary" onClick={copyReceipt}>
            Copy as text
          </button>
          <button className="primary" disabled={isSharing} onClick={shareReceipt}>
            {isSharing ? "Preparing…" : "Send to a friend"}
          </button>
        </div>
      </div>
    </div>
  );
}
