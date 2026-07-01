-- ============================================================
--  MariTrade v2 — Migration: External Credentials (Pre-Verified badge)
--
--  Any user (Trade Party or Logistics Chain) can import mixed-media
--  prior-experience credentials onto their public profile:
--    - CERTIFICATE_URL   — link to an e-certificate hosted elsewhere
--    - CERTIFICATE_IMAGE — photographed/scanned certificate image
--    - RESUME_PDF        — existing resume/CV uploaded as a PDF
--
--  Once a user has at least one credential on file they're shown with
--  a "Pre-Verified" badge everywhere they appear on MariNet — separate
--  from, and in addition to, their account's KYC status.
--
--  Maps to: ExternalCredential[] in types/index.ts, read/written via
--  external_credentials ↔ externalCredentials in lib/db.ts.
-- ============================================================

-- ─── users.external_credentials ──────────────────────────────────────────────
-- Stored as JSONB rather than a normalized table: it's small (max 12 entries,
-- enforced in the API layer), always read/written as a whole array per user,
-- and never queried/filtered independently — a perfect fit for a document
-- column instead of a join.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS external_credentials JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Guard against malformed data — must always be a JSON array.
ALTER TABLE users
  ADD CONSTRAINT external_credentials_is_array
    CHECK (jsonb_typeof(external_credentials) = 'array');

COMMENT ON COLUMN users.external_credentials IS
  'Array of ExternalCredential objects: [{ id, type, title, issuer?, url, addedAt }, ...]. '
  'type is one of CERTIFICATE_URL | CERTIFICATE_IMAGE | RESUME_PDF. '
  'Presence of >=1 entry unlocks the "Pre-Verified" badge (see /api/users/[id]).';

-- ─── storage bucket: credentials ─────────────────────────────────────────────
-- Public bucket — uploaded certificate images / resumes are shown on public
-- profiles, matching the `public: true` config in app/api/upload/route.ts.
-- If your project provisions buckets via the Supabase dashboard instead of
-- migrations (as the pre-existing kyc-documents / milestone-evidence /
-- chat-images buckets appear to be), create "credentials" there instead and
-- skip this INSERT — it's included here for parity/idempotency either way.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'credentials',
  'credentials',
  TRUE,
  15728640, -- 15 MB, matches MAX_SIZES['credentials'] in app/api/upload/route.ts
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone authenticated can upload into their own folder (path is prefixed
-- with the uploader's user id in app/api/upload/route.ts).
CREATE POLICY "credentials_owner_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'credentials' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public bucket — anyone can view (credentials are shown on public profiles).
CREATE POLICY "credentials_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'credentials');

-- Owners can delete their own uploaded credential files.
CREATE POLICY "credentials_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'credentials' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
--  DONE
-- ============================================================
