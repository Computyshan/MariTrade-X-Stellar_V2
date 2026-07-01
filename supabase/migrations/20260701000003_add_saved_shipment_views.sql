-- ============================================================
--  MariTrade v2 — Migration: Saved Shipment List Views
--  Powers the filterable/sortable Shipments list page: lets a
--  user persist a named combination of filters + sort order so
--  they can re-apply it later in one click.
-- ============================================================

CREATE TABLE saved_shipment_views (
  id          TEXT          PRIMARY KEY DEFAULT ('view_' || gen_random_uuid()::text),
  user_id     TEXT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT          NOT NULL,
  filters     JSONB         NOT NULL DEFAULT '{}',
  sort_by     TEXT          NOT NULL DEFAULT 'createdAt',
  sort_dir    TEXT          NOT NULL DEFAULT 'desc' CHECK (sort_dir IN ('asc', 'desc')),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_views_user ON saved_shipment_views(user_id);

ALTER TABLE saved_shipment_views ENABLE ROW LEVEL SECURITY;

-- Personal to the owner — no sharing between users.
CREATE POLICY "saved_views_owner_only" ON saved_shipment_views
  FOR ALL USING (user_id = auth.uid()::text);
