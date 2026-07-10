-- Migration: add preferred_by to connection_requests
-- Powers the "Preferred Partner" fast-track (Implementation Plan §4 —
-- Reputation & Marketplace Pressure, Trade Party item). A Trade Party
-- (Importer/Exporter) can flag a Logistics Chain counterparty on an
-- ACCEPTED connection as "preferred" so future shipment assignment flows
-- can surface/pin them first instead of a fully manual pick each time.
--
-- Mirrors the favorited_by pattern from
-- 20260701000001_add_favorite_connections.sql — personal to whoever
-- toggles it, tracked as an array of user ids rather than a single
-- boolean so it stays unambiguous about who marked it.

ALTER TABLE connection_requests
  ADD COLUMN IF NOT EXISTS preferred_by TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_conn_preferred_by
  ON connection_requests USING GIN (preferred_by);
