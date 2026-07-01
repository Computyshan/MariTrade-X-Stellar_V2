-- Migration: add favorited_by to connection_requests
-- Powers the "Saved/Favorited Counterparties" feature (Growth+/Firm tier).
-- Either party on an ACCEPTED connection can star it as a favorite — this is
-- personal to whoever toggles it, not shared between both parties, so we
-- track who favorited it via favorited_by (array of user ids).

ALTER TABLE connection_requests
  ADD COLUMN IF NOT EXISTS favorited_by TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_conn_favorited_by
  ON connection_requests USING GIN (favorited_by);
