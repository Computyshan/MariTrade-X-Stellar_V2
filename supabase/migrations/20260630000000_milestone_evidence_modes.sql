-- ============================================================
--  MariTrade v2 — Migration: Milestone evidence modes
--
--  Adds evidence_ref (for reference numbers) and makes
--  evidence_url nullable, since not every milestone requires
--  a file upload — many are proven by reference numbers alone.
-- ============================================================

-- 1. Make evidence_url nullable (was NOT NULL)
ALTER TABLE milestone_events
  ALTER COLUMN evidence_url DROP NOT NULL;

-- 2. Add evidence_ref for reference-number-mode milestones
ALTER TABLE milestone_events
  ADD COLUMN IF NOT EXISTS evidence_ref TEXT;

-- At least one of evidence_url or evidence_ref must be present.
-- Enforced at the application layer (API route validates this).
