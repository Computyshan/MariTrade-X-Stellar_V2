-- ============================================================
--  MariTrade v2 — Migration: Team Seats (Multi-Seat Firm Accounts)
--  Introduces a real `firms` entity that multiple users can belong
--  to, replacing the free-text `company_name` field as the source
--  of truth for "who works together". Powers:
--    - Team page: invite/remove seats, see teammates
--    - Shipment visibility: firm members can see shipments any
--      teammate is party to (importer/exporter/assigned)
--    - Reassignment: shipment_assignments can be handed from one
--      departing teammate to another without losing history
-- ============================================================

-- ─── firms ───────────────────────────────────────────────────────────────────
CREATE TABLE firms (
  id          TEXT        PRIMARY KEY DEFAULT ('firm_' || gen_random_uuid()::text),
  name        TEXT        NOT NULL,
  owner_id    TEXT        NOT NULL REFERENCES users(id),
  seat_limit  INT         NOT NULL DEFAULT 5,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_firms_owner ON firms(owner_id);

-- ─── users.firm_id / users.firm_role ─────────────────────────────────────────
-- NOTE: company_name (free text) is left untouched for backwards compatibility
-- and cosmetic display — firm_id is the new relational source of truth for
-- "who can see whose shipments" and "who shares a seat pool".
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS firm_id   TEXT REFERENCES firms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS firm_role TEXT CHECK (firm_role IN ('OWNER', 'MEMBER'));

CREATE INDEX idx_users_firm ON users(firm_id);

-- ─── firm_invites ─────────────────────────────────────────────────────────────
-- Seat invitations sent by a firm owner to an email address. A user accepts
-- by matching their account email against invited_email — no separate
-- token/link flow needed since the app already gates everything behind auth.
CREATE TABLE firm_invites (
  id             TEXT        PRIMARY KEY DEFAULT ('inv_' || gen_random_uuid()::text),
  firm_id        TEXT        NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  invited_email  TEXT        NOT NULL,
  invited_by_id  TEXT        NOT NULL REFERENCES users(id),
  status         TEXT        NOT NULL DEFAULT 'PENDING'
                              CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (firm_id, invited_email)
);

CREATE INDEX idx_firm_invites_firm  ON firm_invites(firm_id);
CREATE INDEX idx_firm_invites_email ON firm_invites(invited_email);

-- ─── updated_at triggers ──────────────────────────────────────────────────────
-- trigger_set_updated_at() already exists from the initial schema migration.
CREATE TRIGGER set_updated_at_firms
  BEFORE UPDATE ON firms
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_firm_invites
  BEFORE UPDATE ON firm_invites
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
--  ROW LEVEL SECURITY
--  (API routes use the service-role client and enforce access in
--   application code — same pattern as every other table in this
--   schema — but policies are still defined here for defense in
--   depth / future direct-client access.)
-- ============================================================

ALTER TABLE firms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_invites ENABLE ROW LEVEL SECURITY;

-- Members (and the owner) can read their own firm.
CREATE POLICY "firms_members_read" ON firms
  FOR SELECT USING (
    owner_id = auth.uid()::text OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid()::text AND u.firm_id = firms.id)
  );

-- Only the owner can create/rename/delete the firm record.
CREATE POLICY "firms_owner_insert" ON firms
  FOR INSERT WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "firms_owner_update" ON firms
  FOR UPDATE USING (owner_id = auth.uid()::text);

CREATE POLICY "firms_owner_delete" ON firms
  FOR DELETE USING (owner_id = auth.uid()::text);

-- The firm owner manages invites for their own firm.
CREATE POLICY "firm_invites_owner_manage" ON firm_invites
  FOR ALL USING (
    EXISTS (SELECT 1 FROM firms f WHERE f.id = firm_invites.firm_id AND f.owner_id = auth.uid()::text)
  );

-- An invited user can see (and later respond to) invites addressed to their
-- own account email.
CREATE POLICY "firm_invites_invitee_read" ON firm_invites
  FOR SELECT USING (
    invited_email = (SELECT email FROM users WHERE id = auth.uid()::text)
  );

-- ── shipments: extend visibility to firm teammates ─────────────────────────
-- A firm member may view a shipment if any *other* member of the same firm
-- is the importer, exporter, or an assigned logistics party on it.
CREATE POLICY "shipments_firm_teammates" ON shipments
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM users me
      JOIN users teammate ON teammate.firm_id = me.firm_id AND me.firm_id IS NOT NULL
      WHERE me.id = auth.uid()::text
        AND (
          teammate.id = shipments.importer_id OR
          teammate.id = shipments.exporter_id OR
          EXISTS (
            SELECT 1 FROM shipment_assignments sa
            WHERE sa.shipment_id = shipments.id AND sa.user_id = teammate.id
          )
        )
    )
  );

-- ============================================================
--  DONE
-- ============================================================
