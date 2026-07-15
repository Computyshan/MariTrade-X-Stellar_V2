-- ============================================================
--  MariTrade v2 — Migration: Phase 5, Direct System Integration
--  (BOC e2m filing, carrier booking API, port/terminal gate
--  webhook, bank/wallet duty pre-funding, trade finance hooks)
--
--  Every table here is additive and optional — existing milestone
--  logging flows are untouched if these integrations are never
--  configured for a given deployment (see lib/integrations/*.ts).
-- ============================================================

-- 1. Evidence provenance on the existing milestone_events table.
--    NULL/omitted is treated as 'MANUAL' by the application layer —
--    no backfill needed for existing rows.
ALTER TABLE milestone_events
  ADD COLUMN IF NOT EXISTS evidence_source TEXT
    CHECK (evidence_source IN ('MANUAL', 'SYSTEM_VERIFIED'));

-- 2. BOC e2m / customs EDI filings.
CREATE TABLE IF NOT EXISTS boc_entry_filings (
  id                       TEXT PRIMARY KEY DEFAULT ('bocf_' || substr(md5(random()::text), 1, 12)),
  shipment_id              TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  filed_by_user_id         TEXT NOT NULL REFERENCES users(id),
  status                   TEXT NOT NULL DEFAULT 'NOT_FILED'
    CHECK (status IN ('NOT_FILED', 'SUBMITTED', 'CONFIRMED', 'REJECTED')),
  entry_series_number      TEXT,
  duties_assessed_usd      NUMERIC,
  official_receipt_number  TEXT,
  submitted_at             TIMESTAMPTZ,
  confirmed_at             TIMESTAMPTZ,
  rejected_reason          TEXT,
  raw_response             TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boc_filings_shipment ON boc_entry_filings(shipment_id);

-- 3. Carrier booking API requests.
CREATE TABLE IF NOT EXISTS carrier_booking_requests (
  id                   TEXT PRIMARY KEY DEFAULT ('cbrq_' || substr(md5(random()::text), 1, 12)),
  shipment_id          TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  requested_by_user_id TEXT NOT NULL REFERENCES users(id),
  carrier_code         TEXT NOT NULL,
  container_type       TEXT,
  status               TEXT NOT NULL DEFAULT 'NOT_REQUESTED'
    CHECK (status IN ('NOT_REQUESTED', 'REQUESTED', 'CONFIRMED', 'FAILED')),
  booking_reference    TEXT,
  vessel_name          TEXT,
  voyage_number        TEXT,
  requested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at         TIMESTAMPTZ,
  failure_reason       TEXT,
  raw_response         TEXT
);

CREATE INDEX IF NOT EXISTS idx_carrier_bookings_shipment ON carrier_booking_requests(shipment_id);

-- 4. Port/terminal gate system webhook events.
CREATE TABLE IF NOT EXISTS port_gate_events (
  id                          TEXT PRIMARY KEY DEFAULT ('pgev_' || substr(md5(random()::text), 1, 12)),
  shipment_id                 TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  terminal_code               TEXT NOT NULL,
  event_type                  TEXT NOT NULL CHECK (event_type IN ('GATE_OUT_ORIGIN', 'GATE_IN_DESTINATION')),
  container_number             TEXT NOT NULL,
  occurred_at                 TIMESTAMPTZ NOT NULL,
  received_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  matched_milestone_event_id  TEXT REFERENCES milestone_events(id) ON DELETE SET NULL,
  raw_payload                 TEXT
);

CREATE INDEX IF NOT EXISTS idx_port_gate_events_shipment ON port_gate_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_port_gate_events_container ON port_gate_events(container_number);

-- 5. Bank/wallet duty pre-funding authorizations.
CREATE TABLE IF NOT EXISTS duty_prefunding_authorizations (
  id                        TEXT PRIMARY KEY DEFAULT ('dpfa_' || substr(md5(random()::text), 1, 12)),
  shipment_id               TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  importer_id               TEXT NOT NULL REFERENCES users(id),
  estimated_duty_amount_usd NUMERIC NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'NOT_REQUESTED'
    CHECK (status IN ('NOT_REQUESTED', 'AUTHORIZED', 'CAPTURED', 'RELEASED', 'CANCELLED')),
  authorized_at             TIMESTAMPTZ,
  captured_at               TIMESTAMPTZ,
  captured_by_user_id       TEXT REFERENCES users(id),
  captured_amount_usd       NUMERIC,
  cancelled_at              TIMESTAMPTZ,
  provider                  TEXT NOT NULL DEFAULT 'MARITRADE_WALLET'
    CHECK (provider IN ('MARITRADE_WALLET', 'BANK_PARTNER')),
  raw_reference             TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_duty_prefunding_shipment ON duty_prefunding_authorizations(shipment_id);

-- 6. Trade finance (LC / invoice financing) links.
CREATE TABLE IF NOT EXISTS trade_finance_links (
  id                    TEXT PRIMARY KEY DEFAULT ('tfln_' || substr(md5(random()::text), 1, 12)),
  shipment_id           TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  importer_id           TEXT NOT NULL REFERENCES users(id),
  instrument_type       TEXT NOT NULL
    CHECK (instrument_type IN ('LETTER_OF_CREDIT', 'INVOICE_FINANCING', 'SUPPLY_CHAIN_FINANCE')),
  provider_name         TEXT NOT NULL,
  reference_number      TEXT NOT NULL,
  face_value_usd        NUMERIC NOT NULL,
  status                TEXT NOT NULL DEFAULT 'LINKED'
    CHECK (status IN ('LINKED', 'ISSUED', 'DRAWN', 'SETTLED', 'EXPIRED', 'CANCELLED')),
  escrow_status_at_link TEXT NOT NULL,
  linked_by_user_id     TEXT NOT NULL REFERENCES users(id),
  linked_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at        TIMESTAMPTZ,
  notes                 TEXT
);

CREATE INDEX IF NOT EXISTS idx_trade_finance_links_shipment ON trade_finance_links(shipment_id);
