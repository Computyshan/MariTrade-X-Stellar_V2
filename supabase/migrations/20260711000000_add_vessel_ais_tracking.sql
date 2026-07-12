-- ============================================================
--  MariTrade v2 — Vessel identity + AIS position cache
--
--  Split out from 20260710000001_add_vessel_ais_tracking.sql, which
--  originally shared its version prefix with the already-applied
--  20260710000001_phase3_verifiable_evidence.sql (same day, two files —
--  Supabase's schema_migrations tracks one row per timestamp prefix, so
--  the collision blocked `supabase db push` with a duplicate-key error).
--  That older file's backfill of milestone_events.ais_verification,
--  iot_devices, iot_sensor_readings, delivery_signatures,
--  recipient_confirmations, and signature_otp_challenges already ran —
--  this migration only adds what's still missing: vessel identity on
--  shipments, and the AIS position cache table.
--
--  1. shipments.vessel_mmsi / vessel_name — set once a Freight Forwarder
--     books/knows the vessel (captured on SPACE_ON_VESSEL_SECURED).
--  2. ais_vessel_positions — a small cache table that scripts/ais-worker.ts
--     (a standalone process — see that file) keeps updated from the
--     aisstream.io WebSocket feed. lib/verification/ais-tracking.ts and
--     app/api/vessels/[mmsi]/route.ts read from this cache instead of
--     calling any HTTP endpoint directly, since aisstream.io is a push
--     (WebSocket) API, not request/response.
-- ============================================================

-- ─── 1. Vessel identity on shipments ───────────────────────────────────────
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS vessel_mmsi TEXT,
  ADD COLUMN IF NOT EXISTS vessel_name TEXT;

CREATE INDEX IF NOT EXISTS idx_shipments_vessel_mmsi ON shipments(vessel_mmsi) WHERE vessel_mmsi IS NOT NULL;

-- ─── 2. AIS position cache ──────────────────────────────────────────────────
-- One row per MMSI, continuously overwritten by scripts/ais-worker.ts as it
-- consumes the aisstream.io WebSocket. The Next.js app only ever reads this
-- table — it never talks to aisstream.io directly.
CREATE TABLE IF NOT EXISTS ais_vessel_positions (
  mmsi          TEXT        PRIMARY KEY,
  ship_name     TEXT,
  imo_number    TEXT,
  latitude      NUMERIC,
  longitude     NUMERIC,
  sog_knots     NUMERIC,      -- speed over ground
  nav_status    TEXT,         -- e.g. "under way using engine", "moored"
  received_at   TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
