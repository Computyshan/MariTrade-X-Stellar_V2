-- ============================================================
--  Fix: job_roles "not empty" CHECK constraint was a no-op.
--
--  array_length(job_roles, 1) returns NULL (not 0/false) when job_roles is
--  '{}' — an empty but non-NULL array. Postgres treats a CHECK expression
--  that evaluates to NULL as passing, so the original constraint from
--  20260702000000_add_multi_role_support.sql never actually rejected an
--  empty array. cardinality() does not have this NULL quirk: it returns 0
--  for an empty array, so `> 0` correctly evaluates to false and the
--  constraint is enforced.
-- ============================================================

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_job_roles_not_empty;
ALTER TABLE users
  ADD CONSTRAINT users_job_roles_not_empty CHECK (cardinality(job_roles) > 0);
