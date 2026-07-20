-- Run this once in Supabase Dashboard → SQL Editor for production AI rate limiting.

create extension if not exists pgcrypto;

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
