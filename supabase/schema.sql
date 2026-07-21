-- Run this in Supabase Dashboard → SQL Editor.
-- Existing rows without a user_id become invisible once RLS is enabled.

create extension if not exists pgcrypto;

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
  status text not null default 'wishlist',
  sort_order integer,
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
alter table public.books add column if not exists status text not null default 'wishlist';
alter table public.books add column if not exists sort_order integer;
alter table public.books alter column status set default 'wishlist';
update public.books set status = 'wishlist' where status is null or status = 'purchased';
with ranked_books as (
  select id, row_number() over (partition by user_id order by created_at desc) as position
  from public.books
  where sort_order is null
)
update public.books
set sort_order = ranked_books.position
from ranked_books
where public.books.id = ranked_books.id;
alter table public.books drop constraint if exists books_status_check;
alter table public.books add constraint books_status_check check (status in ('purchased', 'reading', 'read', 'wishlist'));
create index if not exists books_user_id_idx on public.books(user_id);
create index if not exists books_user_sort_order_idx on public.books(user_id, sort_order);

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

create table if not exists public.library_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  title text not null default 'My library',
  subtitle text not null default 'Every shelf tells a story. Keep yours close.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.library_preferences enable row level security;

drop policy if exists "Users can view their own library preferences" on public.library_preferences;
drop policy if exists "Users can add their own library preferences" on public.library_preferences;
drop policy if exists "Users can update their own library preferences" on public.library_preferences;

create policy "Users can view their own library preferences"
on public.library_preferences for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can add their own library preferences"
on public.library_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own library preferences"
on public.library_preferences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.library_preferences to authenticated;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_lookup_idx
on public.ai_usage_events(user_id, endpoint, created_at desc);

alter table public.ai_usage_events enable row level security;

-- No authenticated-user policies are intentionally granted for this table.
-- Server-side routes should write/read it with SUPABASE_SERVICE_ROLE_KEY only.
