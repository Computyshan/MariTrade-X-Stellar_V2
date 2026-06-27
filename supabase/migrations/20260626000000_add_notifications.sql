-- Migration: add notifications table
-- Fixed: user_id is TEXT (matches users.id which is TEXT throughout this app)
-- Fixed: RLS policy casts auth.uid() to text to avoid uuid = text operator error

-- Drop and recreate cleanly if the table exists with the wrong column type
drop table if exists public.notifications cascade;

create table public.notifications (
  id          text        primary key default ('notif_' || gen_random_uuid()::text),
  user_id     text        not null references public.users(id) on delete cascade,
  type        text        not null,
  title       text        not null,
  body        text        not null,
  link_href   text,
  is_read     boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- Index for fast per-user queries (most recent first)
create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

-- Row Level Security
alter table public.notifications enable row level security;

-- Cast auth.uid() to text so it matches the text user_id column
create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid()::text = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid()::text = user_id);

-- Service role handles inserts from API routes
create policy "Authenticated inserts"
  on public.notifications for insert
  with check (true);
