import { NextResponse } from "next/server";
import { apiError, readJson } from "@/lib/api-response";
import { normalizeBookDraft } from "@/lib/book-utils";
import { hasAiAccess } from "@/lib/ai-access";
import { getAuthenticatedUser } from "@/lib/supabase-server";

const detectedBooksSchema = {
  name: "detected_books",
  strict: true,
  schema: {
    type: "object",
    properties: {
      books: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            author: { type: "string" },
            isbn: { type: ["string", "null"] },
            genre: { type: ["string", "null"] },
            confidence_score: { type: "number" },
          },
          required: ["title", "author", "isbn", "genre", "confidence_score"],
          additionalProperties: false,
        },
      },
    },
    required: ["books"],
    additionalProperties: false,
  },
};

export async function POST(request: Request) {
  try {
    if (!await getAuthenticatedUser()) return apiError("Please sign in first.", { status: 401 });
    if (!hasAiAccess()) return apiError("A valid scan access code is required.", { status: 403 });

    const body = await readJson(request);
    const image = body && typeof body === "object" ? (body as { image?: unknown }).image : null;
    if (!image || typeof image !== "string") return apiError("An image is required.", { status: 400 });
    if (!image.startsWith("data:image/")) return apiError("Upload a valid image file.", { status: 400 });
    if (!process.env.OPENAI_API_KEY) {
      return apiError("AI recognition is not configured yet. Use “Try a sample shelf” to explore the complete flow.", { status: 503 });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Identify every visible book. Read covers and spines carefully. Infer genre when needed. Use lower confidence for uncertain fields. Return an empty array if no book is visible.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract all books in this image." },
              { type: "image_url", image_url: { url: image, detail: "high" } },
            ],
          },
        ],
        response_format: { type: "json_schema", json_schema: detectedBooksSchema },
        max_tokens: 1800,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return apiError("Recognition is temporarily unavailable. Please try again.", { status: 502, cause: { provider: "openai", detail } });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content || "{\"books\":[]}");
    const books = Array.isArray(parsed.books) ? parsed.books.map(normalizeBookDraft).filter(Boolean) : [];

    return NextResponse.json({ books });
  } catch (error) {
    return apiError("We couldn’t read that image. Please try another.", { status: 500, cause: error });
  }
}
