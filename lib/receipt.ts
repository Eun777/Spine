import type { Book } from "./types";

const RECEIPT_DATE_FORMAT = new Intl.DateTimeFormat("en-SG", { dateStyle: "long" });

export function receiptText(books: Book[], owner: string) {
  const date = RECEIPT_DATE_FORMAT.format(new Date());

  return [
    "SPINE BOOK WISHLIST",
    owner ? `A gift list for ${owner}` : "A bookish gift list",
    date,
    "",
    ...books.map((book, index) => `${String(index + 1).padStart(2, "0")}  ${book.title}${book.author ? ` — ${book.author}` : ""}`),
    "",
    `${books.length} ${books.length === 1 ? "BOOK" : "BOOKS"}`,
    "Thank you for making my shelf happier!",
  ].join("\n");
}

export function makeReceiptImage(books: Book[], owner: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const width = 900;
    const rowHeight = 74;
    const headerHeight = 330;
    const footerHeight = 300;
    const height = headerHeight + books.length * rowHeight + footerHeight;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas unavailable"));
      return;
    }

    ctx.fillStyle = "#f8f4e9";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#222";
    ctx.textBaseline = "top";

    const center = (text: string, y: number, font: string) => {
      ctx.font = font;
      ctx.textAlign = "center";
      ctx.fillText(text, width / 2, y);
    };

    const divider = (y: number) => {
      ctx.strokeStyle = "#555";
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(55, y);
      ctx.lineTo(width - 55, y);
      ctx.stroke();
    };

    center("SPINE", 55, "700 76px Georgia");
    center("BOOK WISHLIST", 145, "32px monospace");

    ctx.font = "25px monospace";
    ctx.textAlign = "left";
    ctx.fillText(owner ? `FOR: ${owner.toUpperCase()}` : "A VERY BOOKISH WISHLIST", 58, 220);
    ctx.fillText(RECEIPT_DATE_FORMAT.format(new Date()).toUpperCase(), 58, 260);
    divider(305);

    ctx.font = "22px monospace";
    ctx.fillText("QTY  ITEM", 58, 325);
    ctx.textAlign = "right";
    ctx.fillText("AUTHOR", 842, 325);
    divider(360);

    books.forEach((book, index) => {
      const y = 385 + index * rowHeight;
      ctx.textAlign = "left";
      ctx.font = "25px monospace";
      ctx.fillText(String(index + 1).padStart(2, "0"), 58, y);
      ctx.font = "700 25px monospace";
      ctx.fillText(book.title.length > 35 ? `${book.title.slice(0, 34)}…` : book.title, 130, y);
      ctx.font = "19px monospace";
      ctx.fillStyle = "#666";
      ctx.fillText((book.author || "Unknown author").slice(0, 48), 130, y + 34);
      ctx.fillStyle = "#222";
    });

    const bottom = 385 + books.length * rowHeight;
    divider(bottom);
    ctx.font = "25px monospace";
    ctx.textAlign = "left";
    ctx.fillText("ITEM COUNT:", 58, bottom + 28);
    ctx.textAlign = "right";
    ctx.fillText(String(books.length), 842, bottom + 28);
    divider(bottom + 78);

    center("THANK YOU FOR FEEDING MY TBR!", bottom + 115, "24px monospace");
    ctx.fillStyle = "#222";
    for (let x = 215; x < 685; x += Math.floor(Math.random() * 7) + 5) {
      ctx.fillRect(x, bottom + 170, Math.floor(Math.random() * 5) + 2, 75);
    }
    center("spine · my book wishlist", bottom + 255, "20px monospace");

    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create receipt"));
    }, "image/png");
  });
}
