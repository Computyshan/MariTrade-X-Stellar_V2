-- ============================================================
--  MariTrade v2 — Migration: Phase 4, Proactive Externally-
--  Triggered Nudges (congestion/backlog alerts, delay disclosure)
--
--  Additive only — nothing here changes existing milestone or
--  notification flows. See app/api/cron/delay-monitor/route.ts
--  for the job that writes to this table, and lib/delay-signals.ts
--  for the pluggable external-feed interface it polls.
-- ============================================================

CREATE TABLE IF NOT EXISTS shipment_delay_alerts (
  id                     TEXT PRIMARY KEY DEFAULT ('dlay_' || substr(md5(random()::text), 1, 12)),
  shipment_id            TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  source                 TEXT NOT NULL CHECK (source IN ('PORT_CONGESTION', 'CUSTOMS_BACKLOG')),
  severity               TEXT NOT NULL CHECK (severity IN ('ADVISORY', 'WARNING')),
  summary                TEXT NOT NULL,
  detail                 TEXT,
  detected_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_logistics_at  TIMESTAMPTZ,
  notified_importer_at   TIMESTAMPTZ
);

-- Used by the cron job to find the most recent alert for a given
-- shipment+source, to avoid re-notifying on every poll tick.
CREATE INDEX IF NOT EXISTS idx_delay_alerts_shipment_source
  ON shipment_delay_alerts(shipment_id, source, detected_at DESC);
