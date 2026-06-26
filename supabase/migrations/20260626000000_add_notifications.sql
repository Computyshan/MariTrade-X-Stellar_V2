-- Migration: add notifications table
-- Run this in the Supabase SQL editor or via: supabase db push

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text not null,
  link_href   text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Index for fast per-user queries (most recent first)
create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

-- Row Level Security: users can only see/update their own notifications
alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Allow authenticated users to insert (for server-side API routes using service role)
create policy "Authenticated inserts"
  on public.notifications for insert
  with check (true);
