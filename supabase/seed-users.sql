-- MariTrade v2 — Seed users to match STATIC_USERS in use-user-session.ts
-- Run this once in the Supabase SQL Editor to make mock user IDs resolvable.

INSERT INTO users (id, email, full_name, full_address, contact_number, user_type, job_role, company_name, kyc_status, created_at, updated_at)
VALUES
  (
    'shaun-importer-id',
    'shaun@siga.ph',
    'Tyshaun Louis L. Siga',
    'Mintal, Davao, Philippines',
    '+639171234567',
    'TRADE_PARTY',
    'IMPORTER',
    'Shaun Trading',
    'VERIFIED',
    '2026-01-10T10:00:00Z',
    '2026-01-10T10:00:00Z'
  ),
  (
    'dav4d-exporter-id',
    'dav4d@ngalogistics.jp',
    'Ryan David',
    'Japanacan, Tokyo, Japan',
    '+819012345678',
    'TRADE_PARTY',
    'EXPORTER',
    'Random ass Logistics Corp',
    'VERIFIED',
    '2026-01-11T11:00:00Z',
    '2026-01-11T11:00:00Z'
  ),
  (
    'tristan-forwarder-id',
    'trst@domingsforwarding.ph',
    'Tristan Dominiga',
    'Atlantis, Surigao del Norte, Philippines',
    '+639178881122',
    'LOGISTICS_CHAIN',
    'FREIGHT_FORWARDER',
    'Domingo Global Forwarding',
    'VERIFIED',
    '2026-01-13T08:00:00Z',
    '2026-01-13T08:00:00Z'
  ),
  (
    'quinn-warehouse-id',
    'quinn@warehouse.ph',
    'Quinn Reboqiuo',
    'Dasmariñas, Cavite, Philippines',
    '+639167778899',
    'LOGISTICS_CHAIN',
    'WAREHOUSE_OPERATOR',
    'Metro Manila Distribution Center',
    'VERIFIED',
    '2026-01-15T11:00:00Z',
    '2026-01-15T11:00:00Z'
  ),
  (
    'charles-broker-id',
    'selrach@solomonbrokerage.ph',
    'Charles Solomon',
    'NGAVill, Cagayan De Oro, Philippines',
    '+639189876543',
    'LOGISTICS_CHAIN',
    'CUSTOMS_BROKER',
    'Selcrach Customs Brokerage',
    'VERIFIED',
    '2026-01-12T09:00:00Z',
    '2026-01-12T09:00:00Z'
  )
ON CONFLICT (id) DO NOTHING;
