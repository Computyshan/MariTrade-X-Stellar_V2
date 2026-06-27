-- ============================================================
--  MariTrade v2 — Migration: Shipment Receipts
--  Replaces the old counter-offer negotiation fields with a
--  collaborative "Shipment Receipt" planner that both Trade
--  Party chat participants can edit together. Finalized
--  receipts surface on the Create Shipment page so their data
--  can prefill a new shipment record.
-- ============================================================

-- ─── Repurpose chat_thread_status enum ────────────────────────────────────────
-- OPEN / CLOSED are kept. DEAL_AGREED -> RECEIPT_FINALIZED,
-- COUNTER_OFFER -> RECEIPT_DRAFT.
ALTER TYPE chat_thread_status RENAME VALUE 'DEAL_AGREED' TO 'RECEIPT_FINALIZED';
ALTER TYPE chat_thread_status RENAME VALUE 'COUNTER_OFFER' TO 'RECEIPT_DRAFT';

-- ─── receipt_status enum ───────────────────────────────────────────────────────
CREATE TYPE receipt_status AS ENUM ('DRAFT', 'FINALIZED');

-- ─── shipment_receipts ────────────────────────────────────────────────────────
-- Maps to: interface ShipmentReceipt in types/index.ts
-- One receipt per chat thread (1:1) — both participants can edit it freely
-- while DRAFT; it becomes read-only once FINALIZED.
CREATE TABLE shipment_receipts (
  id                  TEXT            PRIMARY KEY DEFAULT ('rcpt_' || gen_random_uuid()::text),
  thread_id           TEXT            NOT NULL UNIQUE REFERENCES chat_threads(id) ON DELETE CASCADE,
  status              receipt_status  NOT NULL DEFAULT 'DRAFT',

  -- Cargo
  cargo_description   TEXT,
  shipment_scope      shipment_scope,
  estimated_arrival   TIMESTAMPTZ,

  -- Parties
  importer_contact    TEXT,
  exporter_contact    TEXT,

  -- Route
  origin_country      TEXT,
  origin_address      TEXT,
  origin_port         TEXT,
  dest_country        TEXT,
  dest_address        TEXT,
  destination_port    TEXT,

  -- Commercial value
  invoice_currency    TEXT            DEFAULT 'USD' CHECK (invoice_currency IN ('USD','PHP','EUR','GBP','JPY','CNY','SGD')),
  invoice_value       NUMERIC(14,2),
  total_value_usd     NUMERIC(14,2),
  hs_code             TEXT,

  -- Physical specifications
  is_dangerous_goods  BOOLEAN         NOT NULL DEFAULT FALSE,
  package_count       INT,
  packaging_type      TEXT,
  gross_weight        NUMERIC(14,2),
  weight_unit         TEXT            DEFAULT 'KG' CHECK (weight_unit IN ('KG','LBS')),

  last_edited_by_id   TEXT            REFERENCES users(id),
  finalized_by_id     TEXT            REFERENCES users(id),
  finalized_at        TIMESTAMPTZ,

  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_receipts_thread  ON shipment_receipts(thread_id);
CREATE INDEX idx_receipts_status  ON shipment_receipts(status);

CREATE TRIGGER set_updated_at_shipment_receipts
  BEFORE UPDATE ON shipment_receipts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE shipment_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipts_thread_participants" ON shipment_receipts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.thread_id = shipment_receipts.thread_id
        AND cp.user_id = auth.uid()::text
    )
  );

-- ─── Drop the now-unused counter-offer / negotiation columns ─────────────────
-- (cargo_description is left in place since the thread list/search UI still
--  shows a short cargo blurb per chat; it's just no longer the negotiation price.)
ALTER TABLE chat_threads
  DROP COLUMN IF EXISTS current_counter_price_usd;

ALTER TABLE chat_threads
  DROP COLUMN IF EXISTS currency;

ALTER TABLE chat_threads
  DROP CONSTRAINT IF EXISTS chat_threads_currency_check;
