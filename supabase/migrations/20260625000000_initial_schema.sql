-- ============================================================
--  MariTrade v2 — Supabase Migration
--  Generated from: types/index.ts + lib/db.ts + API routes
-- ============================================================

-- ─── escrow_asset column (added post-initial schema) ─────────────────────────
-- Tracks which denomination the importer chose at funding time.
-- The Soroban contract always holds USDC; this column drives UI labels only.
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS escrow_asset TEXT NOT NULL DEFAULT 'USDC'
    CHECK (escrow_asset IN ('USDC', 'PPHP'));

-- ─── Enable UUID extension ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
--  ENUMS
-- ============================================================

CREATE TYPE user_type          AS ENUM ('TRADE_PARTY', 'LOGISTICS_CHAIN');
CREATE TYPE trade_party_role   AS ENUM ('IMPORTER', 'EXPORTER');
CREATE TYPE logistics_chain_role AS ENUM ('FREIGHT_FORWARDER', 'WAREHOUSE_OPERATOR', 'CUSTOMS_BROKER');
-- Combined job_role (union of the two above)
CREATE TYPE job_role AS ENUM (
  'IMPORTER',
  'EXPORTER',
  'FREIGHT_FORWARDER',
  'WAREHOUSE_OPERATOR',
  'CUSTOMS_BROKER'
);

CREATE TYPE kyc_status         AS ENUM ('PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED');
CREATE TYPE shipment_scope     AS ENUM ('NATIONWIDE', 'OVERSEAS');

CREATE TYPE shipment_status AS ENUM (
  'PENDING_EXPORTER',
  'COUNTER_OFFER',
  'CONFIRMED',
  'ESCROW_FUNDED',
  'IN_TRANSIT',
  'AT_PORT',
  'CUSTOMS_CLEARANCE',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DISPUTED',
  'CANCELLED'
);

CREATE TYPE escrow_status AS ENUM ('UNFUNDED', 'FUNDED', 'RELEASED', 'REFUNDED', 'DISPUTED');
CREATE TYPE chat_thread_status AS ENUM ('OPEN', 'DEAL_AGREED', 'COUNTER_OFFER', 'CLOSED');
CREATE TYPE connection_status  AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TYPE milestone_type AS ENUM (
  -- Freight Forwarder
  'BOOKING_CONFIRMED',
  'DOCUMENTS_SUBMITTED_TO_CARRIER',
  'SPACE_ON_VESSEL_SECURED',
  'CONTAINER_GATED_OUT_ORIGIN',
  'CONTAINER_LOADED_ON_VESSEL',
  'VESSEL_CLEARED_TO_DEPART',
  'VESSEL_DEPARTED_ORIGIN',
  'BILL_OF_LADING_ISSUED',
  'VESSEL_ARRIVED_AT_BERTH',
  'VESSEL_ARRIVED_DESTINATION',
  'CONTAINER_OFFLOADED',
  'CONTAINER_GATED_IN_DESTINATION',
  'CARGO_RELEASED_FOR_PICKUP',
  'IN_TRANSIT_TO_DESTINATION',
  'ARRIVED_AT_DELIVERY_ADDRESS',
  'DELIVERED_AND_SIGNED_OFF',
  -- Customs Broker
  'BOC_ENTRY_FILED',
  'PORT_HOLD_PLACED_OR_LIFTED',
  'DUTIES_AND_TAXES_PAID',
  'CUSTOMS_EXAMINATION_REQUESTED',
  'CUSTOMS_CLEARANCE_APPROVED',
  -- Warehouse Operator
  'CARGO_READY_FOR_COLLECTION',
  'CARGO_INSPECTED_AND_PACKED',
  'CARGO_STAGED_FOR_PICKUP',
  'CARGO_HANDED_OFF_TO_CARRIER',
  'CARGO_PICKED_UP_FROM_PORT',
  'CARGO_RECEIVED_AT_WAREHOUSE',
  'INCOMING_CARGO_STORED',
  'FAILED_DELIVERY_ATTEMPT'
);

CREATE TYPE shipment_phase AS ENUM (
  'CARGO_PREPARATION',
  'ORIGIN_PORT_EXPORT',
  'OCEAN_TRANSIT_DESTINATION',
  'LAST_MILE_DELIVERY'
);


-- ============================================================
--  TABLES
-- ============================================================

-- ─── users ───────────────────────────────────────────────────────────────────
-- Maps to: interface User in types/index.ts
-- NOTE: id here is TEXT to match existing seed IDs (e.g. 'shaun-importer-id').
--       After you integrate Supabase Auth, replace with auth.users FK + UUID.
CREATE TABLE users (
  id               TEXT         PRIMARY KEY DEFAULT ('usr_' || gen_random_uuid()::text),
  email            TEXT         NOT NULL UNIQUE,
  full_name        TEXT         NOT NULL,
  full_address     TEXT,
  contact_number   TEXT,
  user_type        user_type    NOT NULL DEFAULT 'TRADE_PARTY',
  job_role         job_role     NOT NULL DEFAULT 'IMPORTER',
  company_name     TEXT,
  stellar_wallet   TEXT,
  bank_details     TEXT,
  kyc_status       kyc_status   NOT NULL DEFAULT 'PENDING',
  kyc_document_url TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── shipments ───────────────────────────────────────────────────────────────
-- Maps to: interface Shipment in types/index.ts
CREATE TABLE shipments (
  id                  TEXT         PRIMARY KEY DEFAULT ('sh_' || gen_random_uuid()::text),
  reference_code      TEXT         NOT NULL UNIQUE,
  importer_id         TEXT         NOT NULL REFERENCES users(id),
  exporter_id         TEXT         REFERENCES users(id),
  description         TEXT         NOT NULL,
  origin_country      TEXT         NOT NULL,
  destination_port    TEXT         NOT NULL,
  shipment_scope      shipment_scope NOT NULL,
  status              shipment_status NOT NULL DEFAULT 'PENDING_EXPORTER',
  total_value_usd     NUMERIC(14,2) NOT NULL,
  escrow_status       escrow_status NOT NULL DEFAULT 'UNFUNDED',
  escrow_amount_usd   NUMERIC(14,2),
  stellar_escrow_id   TEXT,
  estimated_arrival   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── shipment_assignments ────────────────────────────────────────────────────
-- Maps to: interface ShipmentAssignment
CREATE TABLE shipment_assignments (
  id           TEXT        PRIMARY KEY DEFAULT ('asg_' || gen_random_uuid()::text),
  shipment_id  TEXT        NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  user_id      TEXT        NOT NULL REFERENCES users(id),
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shipment_id, user_id)   -- prevent duplicate assignments
);

-- ─── priority_milestones ─────────────────────────────────────────────────────
-- Maps to: interface PriorityMilestone
CREATE TABLE priority_milestones (
  id           TEXT           PRIMARY KEY DEFAULT ('pm_' || gen_random_uuid()::text),
  shipment_id  TEXT           NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  type         milestone_type NOT NULL,
  is_completed BOOLEAN        NOT NULL DEFAULT FALSE,
  UNIQUE (shipment_id, type)
);

-- ─── milestone_events ────────────────────────────────────────────────────────
-- Maps to: interface MilestoneEvent
CREATE TABLE milestone_events (
  id            TEXT           PRIMARY KEY DEFAULT ('me_' || gen_random_uuid()::text),
  shipment_id   TEXT           NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  logged_by_id  TEXT           NOT NULL REFERENCES users(id),
  type          milestone_type NOT NULL,
  description   TEXT,
  evidence_url  TEXT           NOT NULL,
  occurred_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  verified      BOOLEAN        NOT NULL DEFAULT FALSE
);

-- ─── shipment_documents ──────────────────────────────────────────────────────
-- Maps to: interface ShipmentDocument
CREATE TABLE shipment_documents (
  id             TEXT        PRIMARY KEY DEFAULT ('doc_' || gen_random_uuid()::text),
  shipment_id    TEXT        NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  file_name      TEXT        NOT NULL,
  file_url       TEXT        NOT NULL,
  uploaded_by_id TEXT        NOT NULL REFERENCES users(id),
  version        INT         NOT NULL DEFAULT 1,
  is_latest      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── chat_threads ────────────────────────────────────────────────────────────
-- Maps to: interface ChatThread
CREATE TABLE chat_threads (
  id                        TEXT              PRIMARY KEY DEFAULT ('thr_' || gen_random_uuid()::text),
  status                    chat_thread_status NOT NULL DEFAULT 'OPEN',
  shipment_id               TEXT              REFERENCES shipments(id) ON DELETE SET NULL,
  cargo_description         TEXT,
  current_counter_price_usd NUMERIC(14,2),
  created_at                TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- ─── chat_participants ───────────────────────────────────────────────────────
-- Maps to: interface ChatParticipant
CREATE TABLE chat_participants (
  id         TEXT PRIMARY KEY DEFAULT ('cp_' || gen_random_uuid()::text),
  thread_id  TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id),
  UNIQUE (thread_id, user_id)
);

-- ─── messages ────────────────────────────────────────────────────────────────
-- Maps to: interface Message
CREATE TABLE messages (
  id         TEXT        PRIMARY KEY DEFAULT ('msg_' || gen_random_uuid()::text),
  thread_id  TEXT        NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id  TEXT        NOT NULL REFERENCES users(id),
  content    TEXT        NOT NULL,
  image_url  TEXT,
  is_unsent  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── connection_requests ─────────────────────────────────────────────────────
-- Maps to: interface ConnectionRequest (B2B Vendor Network)
CREATE TABLE connection_requests (
  id           TEXT              PRIMARY KEY DEFAULT ('conn_' || gen_random_uuid()::text),
  requester_id TEXT              NOT NULL REFERENCES users(id),
  receiver_id  TEXT              NOT NULL REFERENCES users(id),
  status       connection_status NOT NULL DEFAULT 'PENDING',
  created_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  UNIQUE (requester_id, receiver_id),
  CHECK (requester_id <> receiver_id)
);

-- ─── vault_folders ───────────────────────────────────────────────────────────
-- Maps to: interface VaultFolder (BOC Document Vault)
-- NOTE: password is stored in plain text here to match current demo behaviour.
--       Replace with a bcrypt hash column in production.
CREATE TABLE vault_folders (
  id                  TEXT        PRIMARY KEY DEFAULT ('vf_' || gen_random_uuid()::text),
  shipment_id         TEXT        NOT NULL UNIQUE REFERENCES shipments(id) ON DELETE CASCADE,
  reference_code      TEXT        NOT NULL,
  folder_name         TEXT        NOT NULL,
  password            TEXT        NOT NULL,   -- ⚠️  hash this in production
  created_by_user_id  TEXT        NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
--  INDEXES  (query patterns observed in the API routes)
-- ============================================================

CREATE INDEX idx_shipments_importer   ON shipments(importer_id);
CREATE INDEX idx_shipments_exporter   ON shipments(exporter_id);
CREATE INDEX idx_shipments_status     ON shipments(status);
CREATE INDEX idx_shipments_ref_code   ON shipments(reference_code);

CREATE INDEX idx_assignments_shipment ON shipment_assignments(shipment_id);
CREATE INDEX idx_assignments_user     ON shipment_assignments(user_id);

CREATE INDEX idx_pm_shipment          ON priority_milestones(shipment_id);

CREATE INDEX idx_me_shipment          ON milestone_events(shipment_id);
CREATE INDEX idx_me_type              ON milestone_events(type);

CREATE INDEX idx_docs_shipment        ON shipment_documents(shipment_id);
CREATE INDEX idx_docs_latest          ON shipment_documents(shipment_id, is_latest);

CREATE INDEX idx_participants_thread  ON chat_participants(thread_id);
CREATE INDEX idx_participants_user    ON chat_participants(user_id);

CREATE INDEX idx_messages_thread      ON messages(thread_id, created_at);

CREATE INDEX idx_conn_requester       ON connection_requests(requester_id, status);
CREATE INDEX idx_conn_receiver        ON connection_requests(receiver_id, status);

CREATE INDEX idx_vault_shipment       ON vault_folders(shipment_id);


-- ============================================================
--  UPDATED_AT TRIGGER  (auto-maintains updated_at columns)
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_shipments
  BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_chat_threads
  BEFORE UPDATE ON chat_threads
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_connection_requests
  BEFORE UPDATE ON connection_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================
--  ROW LEVEL SECURITY (RLS) — boilerplate stubs
--  Fill in with your actual Supabase Auth user logic.
-- ============================================================

ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE priority_milestones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_threads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_folders        ENABLE ROW LEVEL SECURITY;

-- Example: users can read/update their own profile
CREATE POLICY "users_own_row" ON users
  FOR ALL USING (auth.uid()::text = id);

-- Example: authenticated users can read shipments they are part of
CREATE POLICY "shipments_involved_users" ON shipments
  FOR SELECT USING (
    auth.uid()::text = importer_id OR
    auth.uid()::text = exporter_id OR
    EXISTS (
      SELECT 1 FROM shipment_assignments sa
      WHERE sa.shipment_id = id AND sa.user_id = auth.uid()::text
    )
  );

-- (Add more fine-grained policies per your auth requirements)


-- ============================================================
--  SEED DATA  (mirrors lib/db.ts INITIAL_* constants)
-- ============================================================

-- ─── Users ───────────────────────────────────────────────────────────────────
INSERT INTO users (id, email, full_name, full_address, contact_number, user_type, job_role, company_name, kyc_status, created_at, updated_at) VALUES
  ('shaun-importer-id',   'shaun@siga.ph',                    'Tyshaun Louis L. Siga', 'Mintal, Davao, Philippines',           '+639171234567', 'TRADE_PARTY',    'IMPORTER',          'Shaun Trading',                  'VERIFIED', '2026-01-10T10:00:00Z', '2026-01-10T10:00:00Z'),
  ('dav4d-exporter-id',   'dav4d@ngalogistics.jp',            'Ryan David',             'Japanacan, Tokyo, Japan',              '+819012345678', 'TRADE_PARTY',    'EXPORTER',          'Random ass Logistics Corp',       'VERIFIED', '2026-01-11T11:00:00Z', '2026-01-11T11:00:00Z'),
  ('tristan-forwarder-id','trst@domingsforwarding.ph',         'Tristan Dominiga',       'Atlantis, Surigao del Norte, Philippines','+639178881122','LOGISTICS_CHAIN','FREIGHT_FORWARDER', 'Domingo Global Forwarding',      'VERIFIED', '2026-01-13T08:00:00Z', '2026-01-13T08:00:00Z'),
  ('quinn-warehouse-id',  'quinn@warehouse.ph',                'Quinn Reboqiuo',          'Dasmariñas, Cavite, Philippines',     '+639167778899', 'LOGISTICS_CHAIN','WAREHOUSE_OPERATOR','Metro Manila Distribution Center','VERIFIED', '2026-01-15T11:00:00Z', '2026-01-15T11:00:00Z'),
  ('charles-broker-id',   'selrach@solomonbrokerage.ph',       'Charles Solomon',         'NGAVill, Cagayan De Oro, Philippines','+639189876543', 'LOGISTICS_CHAIN','CUSTOMS_BROKER',    'Selcrach Customs Brokerage',     'VERIFIED', '2026-01-12T09:00:00Z', '2026-01-12T09:00:00Z');

-- ─── Shipments ───────────────────────────────────────────────────────────────
INSERT INTO shipments (id, reference_code, importer_id, exporter_id, description, origin_country, destination_port, shipment_scope, status, total_value_usd, escrow_status, escrow_amount_usd, stellar_escrow_id, estimated_arrival, created_at, updated_at) VALUES
  ('shipment-tokyo-manila-1', 'MT-2026-00341', 'shaun-importer-id', 'dav4d-exporter-id',  'Industrial Electric Motors and Replacement Gears', 'Japan (Tokyo)',          'Port of Manila (MICP)', 'OVERSEAS',    'IN_TRANSIT', 45000, 'FUNDED',   45000, 'GCE6...KCSU_ESCROW_ESC341', '2026-06-28T18:00:00Z', '2026-05-15T08:24:00Z', '2026-06-18T10:15:00Z'),
  ('shipment-zambo-manila-2', 'MT-2026-00122', 'shaun-importer-id', 'shaun-importer-id',  'Fresh Mindanao Canned Sardines Batch 22B',         'Philippines (Zamboanga)','Manila North Harbor',   'NATIONWIDE',  'DELIVERED',  12500, 'RELEASED', 12500, 'GDE3...JKLD_ESCROW_ESC122', '2026-06-05T12:00:00Z', '2026-05-10T09:00:00Z', '2026-06-05T15:30:00Z');

-- ─── Shipment Assignments ────────────────────────────────────────────────────
INSERT INTO shipment_assignments (id, shipment_id, user_id, assigned_at) VALUES
  ('assign-1', 'shipment-tokyo-manila-1', 'charles-broker-id',    '2026-05-16T10:00:00Z'),
  ('assign-2', 'shipment-tokyo-manila-1', 'tristan-forwarder-id', '2026-05-16T09:30:00Z'),
  ('assign-3', 'shipment-tokyo-manila-1', 'quinn-warehouse-id',   '2026-05-16T11:00:00Z');

-- ─── Priority Milestones ─────────────────────────────────────────────────────
INSERT INTO priority_milestones (id, shipment_id, type, is_completed) VALUES
  ('pm-1', 'shipment-tokyo-manila-1', 'CUSTOMS_CLEARANCE_APPROVED', FALSE),
  ('pm-2', 'shipment-tokyo-manila-1', 'DELIVERED_AND_SIGNED_OFF',   FALSE),
  ('pm-3', 'shipment-zambo-manila-2', 'CUSTOMS_CLEARANCE_APPROVED', TRUE),
  ('pm-4', 'shipment-zambo-manila-2', 'DELIVERED_AND_SIGNED_OFF',   TRUE);

-- ─── Milestone Events ────────────────────────────────────────────────────────
INSERT INTO milestone_events (id, shipment_id, logged_by_id, type, description, evidence_url, occurred_at, verified) VALUES
  ('me-1', 'shipment-tokyo-manila-1', 'tristan-forwarder-id', 'BOOKING_CONFIRMED',       'Vessel spot booked on Maersk Tokyo Express.',                            'https://picsum.photos/seed/booking/800/600', '2026-05-18T14:30:00Z', TRUE),
  ('me-2', 'shipment-tokyo-manila-1', 'tristan-forwarder-id', 'SPACE_ON_VESSEL_SECURED', 'Container sealed and space locked on bay 3A.',                           'https://picsum.photos/seed/seal/800/600',    '2026-05-20T11:00:00Z', TRUE),
  ('me-3', 'shipment-tokyo-manila-1', 'charles-broker-id',    'BOC_ENTRY_FILED',         'BOC single administrative document (SAD) logged at MICP.',               'https://picsum.photos/seed/boc/800/600',     '2026-06-18T10:15:00Z', TRUE),
  ('me-4', 'shipment-zambo-manila-2', 'tristan-forwarder-id', 'BOOKING_CONFIRMED',       'Direct sea cargo booked by forwarder.',                                  'https://picsum.photos/seed/boat/800/600',    '2026-05-12T08:00:00Z', TRUE),
  ('me-5', 'shipment-zambo-manila-2', 'charles-broker-id',    'CUSTOMS_CLEARANCE_APPROVED','Zamboanga customs duty clearance verified and tax receipt issued.',     'https://picsum.photos/seed/receipt/800/600', '2026-05-28T16:00:00Z', TRUE),
  ('me-6', 'shipment-zambo-manila-2', 'tristan-forwarder-id', 'DELIVERED_AND_SIGNED_OFF','Sardine crates delivered safely to Binondo Storage Hall. Signed off by importer.','https://picsum.photos/seed/storage/800/600','2026-06-05T15:30:00Z',TRUE);

-- ─── Shipment Documents ──────────────────────────────────────────────────────
INSERT INTO shipment_documents (id, shipment_id, file_name, file_url, uploaded_by_id, version, is_latest, created_at) VALUES
  ('doc-1', 'shipment-tokyo-manila-1', 'BillOfLading_MT341_Maersk.pdf',            'https://picsum.photos/seed/doc1/800/600', 'tristan-forwarder-id', 1, TRUE, '2026-05-18T14:40:00Z'),
  ('doc-2', 'shipment-tokyo-manila-1', 'BOC_Import_Declaration_SAD_Signed.pdf',    'https://picsum.photos/seed/doc2/800/600', 'charles-broker-id',    1, TRUE, '2026-06-18T10:20:00Z'),
  ('doc-3', 'shipment-tokyo-manila-1', 'Amended_Commercial_Invoice_Tanaka.pdf',    'https://picsum.photos/seed/doc3/800/600', 'dav4d-exporter-id',    2, TRUE, '2026-06-19T13:00:00Z'),
  ('doc-4', 'shipment-zambo-manila-2', 'Domestic_Cargo_Release_Slip.pdf',          'https://picsum.photos/seed/doc4/800/600', 'shaun-importer-id',    1, TRUE, '2026-05-14T09:30:00Z');

-- ─── Vault Folders ───────────────────────────────────────────────────────────
INSERT INTO vault_folders (id, shipment_id, reference_code, folder_name, password, created_by_user_id, created_at) VALUES
  ('vault-folder-001', 'shipment-tokyo-manila-1', 'MT-2026-00341', 'JPN-MNL_INDUSTRIAL_MOTORS_2026', 'TKY2026', 'shaun-importer-id', '2026-05-15T08:30:00Z'),
  ('vault-folder-002', 'shipment-zambo-manila-2', 'MT-2026-00122', 'ZMB-MNL_SARDINES_BATCH22B_2026', 'ZMB2026', 'shaun-importer-id', '2026-05-10T09:15:00Z');

-- ─── Connection Requests ─────────────────────────────────────────────────────
INSERT INTO connection_requests (id, requester_id, receiver_id, status, created_at, updated_at) VALUES
  ('conn-shaun-tristan-1', 'shaun-importer-id', 'tristan-forwarder-id', 'ACCEPTED', '2026-01-20T09:00:00Z', '2026-01-20T10:30:00Z'),
  ('conn-shaun-charles-1', 'shaun-importer-id', 'charles-broker-id',    'ACCEPTED', '2026-01-20T09:05:00Z', '2026-01-20T10:35:00Z'),
  ('conn-shaun-quinn-1',   'shaun-importer-id', 'quinn-warehouse-id',   'PENDING',  '2026-06-20T14:00:00Z', '2026-06-20T14:00:00Z');


-- ============================================================
--  DONE
-- ============================================================
