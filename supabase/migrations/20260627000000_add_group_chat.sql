-- ============================================================
--  MariTrade v2 — Migration: Group Chat + Content Fix
--  Add is_group / group_name to chat_threads
--  Allow nullable content on messages (image-only support)
-- ============================================================

-- Add group chat columns to chat_threads
ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS is_group   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Allow image-only messages (content was NOT NULL, breaking attachments)
ALTER TABLE messages
  ALTER COLUMN content DROP NOT NULL;
