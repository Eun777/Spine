-- Run this once in Supabase Dashboard → SQL Editor for existing projects.

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
