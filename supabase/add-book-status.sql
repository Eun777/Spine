-- Add collection tracking to an existing Spine books table.
alter table public.books
  add column if not exists status text not null default 'wishlist';

alter table public.books
  alter column status set default 'wishlist';

update public.books
  set status = 'wishlist'
  where status is null or status = 'purchased';

alter table public.books
  drop constraint if exists books_status_check;

alter table public.books
  add constraint books_status_check
  check (status in ('purchased', 'reading', 'read', 'wishlist'));
