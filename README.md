# Spine

Spine helps you manage the 101 books you want to read. See a book you like in the book store? Were you going to just snap a photo? You are likely to lose that photo among the millions of other photos in your library. Use Spine to note down the book you are looking for instead!

## Key Features

### Search for books (Free for all users!)

Use "Search" to find books and save them to your library to read in the future. (Powered by Open Library API)

### Scan books you wanna read (Paid feature)

Lazy to type and search individually? Use this feature and scan up to 8 books at once! Use a well lit environment with clear names and Spine will see if there is a match with a book on Open Library!

### Find on NLB

You can search for the book on NLB with just one click of a button!

### Track your collection

Mark books as Purchased, Reading now, Read, or Wish to buy, and filter your library by status. New and unclassified books default to Wish to buy.

## Production setup

Create `.env.local` with:

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
BOOK_SCAN_ACCESS_CODE=your_private_scan_code
OPENAI_API_KEY=your_openai_api_key
NLB_API_KEY=your_nlb_open_web_service_api_key
NLB_APP_CODE=your_nlb_open_web_service_app_code
```

Optional:

```bash
GOOGLE_BOOKS_API_KEY=your_google_books_key
NLB_CATALOGUE_BASE_URL=https://openweb.nlb.gov.sg/api/v2/Catalogue
```

`NLB_API_KEY` and `NLB_APP_CODE` must stay server-side in `.env.local`; do not prefix them with `NEXT_PUBLIC_`. The app uses them through `/api/nlb/availability` so credentials are never exposed to the browser.

Run `supabase/schema.sql` for a fresh database. For an existing database, run `supabase/add-book-status.sql` once so every saved book has a valid collection status.

## Engineering notes

- Server routes validate request bodies before calling external services.
- Book status, duplicate matching, Open Library mapping, and NLB URLs live in shared library helpers to keep behavior consistent across scan, search, local storage, and Supabase.
- AI scanning is protected by both Supabase authentication and `BOOK_SCAN_ACCESS_CODE`.
- Run `pnpm run build` before deploying.
