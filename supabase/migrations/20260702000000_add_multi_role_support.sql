-- ============================================================
--  Multi-role support for User accounts
--  A single account can now hold more than one Job Role at once —
--  e.g. a Trade Party account that is both Importer and Exporter, or a
--  Logistics Chain account that is simultaneously Freight Forwarder and
--  Customs Broker, mirroring how a single trusted operator often wears
--  several hats in real Philippine SME freight operations.
--
--  job_role (singular) is retained as the "primary" role for legacy display
--  and default-selection purposes. job_roles (plural, array) is the source
--  of truth for what the account can actually do — exporter matching in the
--  Create Shipment flow, logistics-chain assignment, and milestone-logging
--  permission all read from job_roles going forward.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS job_roles job_role[] NOT NULL DEFAULT ARRAY[]::job_role[];

-- Backfill: every existing user's single job_role becomes their first (and
-- initially only) entry in job_roles.
UPDATE users
  SET job_roles = ARRAY[job_role]
  WHERE job_roles = '{}';

-- Guard: job_roles must never be empty. (Category consistency — Trade Party
-- roles never mixing with Logistics Chain roles — is enforced at the
-- application layer in types/index.ts (areJobRolesConsistent) and the
-- profile/onboarding API routes, since a portable CHECK over array contents
-- against another column requires a helper function; simpler and clearer to
-- keep that rule in application code alongside the rest of the role logic.)
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_job_roles_not_empty;
ALTER TABLE users
  ADD CONSTRAINT users_job_roles_not_empty CHECK (array_length(job_roles, 1) > 0);

-- Index to support "find all EXPORTER-capable users", "find all
-- CUSTOMS_BROKER-capable users", etc. without a full table scan.
CREATE INDEX IF NOT EXISTS idx_users_job_roles ON users USING GIN (job_roles);
