-- ============================================================
--  MariTrade v2 — Migration: Multiple Shipment Receipts per Thread
--
--  Previously a chat thread could only ever have ONE shipment_receipts
--  row (thread_id was UNIQUE). That meant once a receipt was FINALIZED,
--  the same importer/exporter pair could never start a fresh
--  negotiation in that same thread.
--
--  This migration:
--   1. Drops the UNIQUE constraint on thread_id, so a thread can have
--      a history of many receipts (one per negotiation round).
--   2. Adds a partial unique index that still guarantees at most ONE
--      DRAFT receipt can exist per thread at a time — finalized
--      receipts are exempt, so history can grow freely.
-- ============================================================

-- 1. Drop the old 1:1 unique constraint on thread_id.
--    (Constraint name follows Postgres's default naming convention
--    for a column-level UNIQUE: <table>_<column>_key)
ALTER TABLE shipment_receipts
  DROP CONSTRAINT IF EXISTS shipment_receipts_thread_id_key;

-- 2. Re-create the plain (non-unique) index, since DROP CONSTRAINT can
--    drop a backing index Postgres had merged with the UNIQUE constraint.
--    (idx_receipts_thread already exists from the original migration —
--    this is a defensive no-op if it's still there.)
CREATE INDEX IF NOT EXISTS idx_receipts_thread ON shipment_receipts(thread_id);

-- 3. Enforce "only one active DRAFT per thread" so the New Receipt action
--    can't spawn duplicate drafts if double-clicked / called twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_one_draft_per_thread
  ON shipment_receipts(thread_id)
  WHERE status = 'DRAFT';
