-- Migration: add tracking page tier + white-label branding to users
-- Powers the "Tracking Page Tiers" feature:
--   BRANDED    — status header only, MariTrade-branded public link (default/free tier)
--   TIMELINE   — full milestone-by-milestone timeline on the public tracking page
--   WHITELABEL — timeline + custom logo/accent color override on the public page
--
-- Tier is owned by the Importer (the party that creates the shipment and
-- shares the tracking link), so it lives on `users`, not `shipments` —
-- one upgrade applies to every shipment that importer creates.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tracking_tier TEXT NOT NULL DEFAULT 'BRANDED'
    CHECK (tracking_tier IN ('BRANDED', 'TIMELINE', 'WHITELABEL'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS branding_logo_url TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS branding_primary_color TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS branding_company_label TEXT;
