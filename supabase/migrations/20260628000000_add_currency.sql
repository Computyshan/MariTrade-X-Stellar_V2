-- ============================================================
--  MariTrade v2 — Migration: Negotiation Currency Support
--  Add currency to chat_threads so Importers/Exporters can
--  negotiate in a currency other than USD.
-- ============================================================

-- Add currency column to chat_threads (defaults to USD for existing rows)
ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

-- Constrain to a fixed, known list of currencies the UI supports.
-- Drop first so this migration is safely re-runnable.
ALTER TABLE chat_threads
  DROP CONSTRAINT IF EXISTS chat_threads_currency_check;

ALTER TABLE chat_threads
  ADD CONSTRAINT chat_threads_currency_check
  CHECK (currency IN ('USD', 'PHP', 'EUR', 'GBP', 'JPY', 'CNY', 'SGD'));
