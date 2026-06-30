export type BookDraft = {
  title: string;
  author: string;
  isbn: string | null;
  genre: string | null;
  cover_image_url?: string | null;
  confidence_score: number | null;
  description?: string | null;
  publisher?: string | null;
  published_date?: string | null;
  page_count?: number | null;
  categories?: string[] | null;
  language?: string | null;
  google_books_id?: string | null;
  open_library_id?: string | null;
  preview_url?: string | null;
  average_rating?: number | null;
  ratings_count?: number | null;
  metadata_source?: "google_books" | "open_library" | null;
};

export type Book = BookDraft & {
  id: string;
  created_at: string;
  updated_at: string;
};
