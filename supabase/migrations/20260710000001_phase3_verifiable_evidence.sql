-- ============================================================
--  MariTrade v2 — Migration: Phase 3, Independently-Verifiable
--  Evidence (IoT ingestion, AIS cross-check, digital signature
--  capture, recipient-side confirmation)
--
--  Every table here is additive and optional — existing milestone
--  logging flows are untouched if these features are never used.
-- ============================================================

-- 1. AIS cross-check result, stored inline on the milestone it
--    corroborates (VESSEL_DEPARTED_ORIGIN only in practice).
ALTER TABLE milestone_events
  ADD COLUMN IF NOT EXISTS ais_verification JSONB;

-- 2. IoT devices registered per shipment — required so an inbound
--    webhook post can be authenticated and attributed.
CREATE TABLE IF NOT EXISTS iot_devices (
  id                TEXT PRIMARY KEY DEFAULT ('iotd_' || substr(md5(random()::text), 1, 12)),
  shipment_id       TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  device_id         TEXT NOT NULL UNIQUE,
  device_secret     TEXT NOT NULL,
  label             TEXT,
  registered_by_id  TEXT NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iot_devices_shipment ON iot_devices(shipment_id);

-- 3. IoT sensor readings ingested from those devices.
CREATE TABLE IF NOT EXISTS iot_sensor_readings (
  id                  TEXT PRIMARY KEY DEFAULT ('iotr_' || substr(md5(random()::text), 1, 12)),
  shipment_id         TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  milestone_event_id  TEXT REFERENCES milestone_events(id) ON DELETE SET NULL,
  device_id           TEXT NOT NULL,
  reading_type        TEXT NOT NULL CHECK (reading_type IN ('TEMPERATURE','HUMIDITY','SHOCK','GPS','DOOR_OPEN')),
  value               NUMERIC NOT NULL,
  unit                TEXT NOT NULL,
  latitude            NUMERIC,
  longitude           NUMERIC,
  recorded_at         TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iot_readings_shipment ON iot_sensor_readings(shipment_id);
CREATE INDEX IF NOT EXISTS idx_iot_readings_milestone ON iot_sensor_readings(milestone_event_id);

-- 4. Digital signature capture at delivery.
CREATE TABLE IF NOT EXISTS delivery_signatures (
  id                          TEXT PRIMARY KEY DEFAULT ('dsig_' || substr(md5(random()::text), 1, 12)),
  milestone_event_id          TEXT NOT NULL UNIQUE REFERENCES milestone_events(id) ON DELETE CASCADE,
  shipment_id                 TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  signer_name                 TEXT NOT NULL,
  signer_relation             TEXT NOT NULL CHECK (signer_relation IN ('CONSIGNEE','AUTHORIZED_REPRESENTATIVE','OTHER')),
  signature_image_data_url    TEXT NOT NULL,
  otp_verified                BOOLEAN NOT NULL DEFAULT false,
  otp_verified_contact_masked TEXT,
  signed_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Recipient-side confirmation flow.
CREATE TABLE IF NOT EXISTS recipient_confirmations (
  id                   TEXT PRIMARY KEY DEFAULT ('rcon_' || substr(md5(random()::text), 1, 12)),
  shipment_id          TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  milestone_event_id   TEXT REFERENCES milestone_events(id) ON DELETE SET NULL,
  consignee_contact    TEXT NOT NULL,
  consignee_name       TEXT,
  status               TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','DISPUTED','EXPIRED')),
  confirmation_token   TEXT NOT NULL UNIQUE,
  requested_by_id      TEXT NOT NULL REFERENCES users(id),
  requested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at         TIMESTAMPTZ,
  dispute_note         TEXT
);

CREATE INDEX IF NOT EXISTS idx_recipient_confirmations_shipment ON recipient_confirmations(shipment_id);
CREATE INDEX IF NOT EXISTS idx_recipient_confirmations_token ON recipient_confirmations(confirmation_token);

-- 6. Short-lived OTP challenges for digital signature capture — ties the
--    signature pad tap to the recipient's phone/email, not just a tap.
CREATE TABLE IF NOT EXISTS signature_otp_challenges (
  id            TEXT PRIMARY KEY DEFAULT ('sotp_' || substr(md5(random()::text), 1, 12)),
  shipment_id   TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  contact       TEXT NOT NULL,
  otp_code      TEXT NOT NULL,
  verified      BOOLEAN NOT NULL DEFAULT false,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signature_otp_shipment ON signature_otp_challenges(shipment_id);
