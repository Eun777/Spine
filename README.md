# Book Recognition MVP

A mobile-first Next.js app for scanning, reviewing, and saving books.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Copy `.env.example` to `.env.local` and configure:

```env
OPENAI_API_KEY=your-openai-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-publishable-or-anon-key
BOOK_SCAN_ACCESS_CODE=choose-a-long-private-code
GOOGLE_BOOKS_API_KEY=optional-google-books-key
```

Then run `supabase/schema.sql` in the Supabase SQL Editor. Email/password authentication is enabled by default in hosted Supabase projects; by default, new users must confirm their email. The shared scan code is an additional cost-control gate for OpenAI usage and should be distributed only to approved users.

Recognized books are automatically enriched with cover art, publisher, publication date, page count, language, categories, description, ratings when available, and an external details link. Google Books is used when `GOOGLE_BOOKS_API_KEY` is set; otherwise the app falls back to the keyless Open Library API.

Authenticated users can also use `/search` to search Open Library by title, author, or ISBN and save results without unlocking or spending AI credits.
