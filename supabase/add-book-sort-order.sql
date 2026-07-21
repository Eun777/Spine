-- Add persisted library ordering to an existing Spine books table.

alter table public.books
  add column if not exists sort_order integer;

with ranked_books as (
  select id, row_number() over (partition by user_id order by created_at desc) as position
  from public.books
  where sort_order is null
)
update public.books
set sort_order = ranked_books.position
from ranked_books
where public.books.id = ranked_books.id;

create index if not exists books_user_sort_order_idx
on public.books(user_id, sort_order);
