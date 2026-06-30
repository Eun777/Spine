-- Run this in Supabase Dashboard → SQL Editor.
-- Existing rows without a user_id become invisible once RLS is enabled.

create table if not exists public.books (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  author text not null default '',
  isbn text,
  genre text,
  cover_image_url text,
  confidence_score double precision,
  description text,
  publisher text,
  published_date text,
  page_count integer,
  categories text[],
  language text,
  google_books_id text,
  open_library_id text,
  preview_url text,
  average_rating double precision,
  ratings_count integer,
  metadata_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.books add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.books add column if not exists description text;
alter table public.books add column if not exists publisher text;
alter table public.books add column if not exists published_date text;
alter table public.books add column if not exists page_count integer;
alter table public.books add column if not exists categories text[];
alter table public.books add column if not exists language text;
alter table public.books add column if not exists google_books_id text;
alter table public.books add column if not exists open_library_id text;
alter table public.books add column if not exists preview_url text;
alter table public.books add column if not exists average_rating double precision;
alter table public.books add column if not exists ratings_count integer;
alter table public.books add column if not exists metadata_source text;
create index if not exists books_user_id_idx on public.books(user_id);

alter table public.books enable row level security;

drop policy if exists "Users can view their own books" on public.books;
drop policy if exists "Users can add their own books" on public.books;
drop policy if exists "Users can update their own books" on public.books;
drop policy if exists "Users can delete their own books" on public.books;

create policy "Users can view their own books"
on public.books for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can add their own books"
on public.books for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own books"
on public.books for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own books"
on public.books for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.books to authenticated;
