-- ============================================================
--  Admin role support
--
--  Adds an ADMIN value to both job_role and user_type so internal platform
--  staff accounts can be represented in the same users table as everyone
--  else. ADMIN is intentionally NOT wired into the public sign-up flow:
--
--    - app/(auth)/register/page.tsx + /api/auth/register always create new
--      accounts as user_type='TRADE_PARTY', job_role='IMPORTER'.
--    - app/(auth)/onboarding/page.tsx only ever renders the hard-coded
--      tradePartyJobs / logisticsJobs option lists — ADMIN is never one of
--      the choices a user can click.
--    - /api/auth/onboarding explicitly rejects any request that tries to set
--      userType/jobRole/jobRoles to ADMIN, regardless of what the client sends.
--
--  The only supported way to create an admin account is scripts/create-admin.ts,
--  run locally by a developer/ops person with the Supabase service-role key.
-- ============================================================

ALTER TYPE job_role  ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'ADMIN';
