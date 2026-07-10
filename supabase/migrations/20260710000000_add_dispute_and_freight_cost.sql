-- ============================================================
--  MariTrade v2 — Add dispute reason/timestamp + freight cost
--  Supports: lib/gemini/index.ts summarizeDisputeEvidence()
--            lib/gemini/index.ts benchmarkFreightRate()
--            lib/rate-benchmark.ts computeRouteFreightStats()
-- ============================================================

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS dispute_reason    TEXT,
  ADD COLUMN IF NOT EXISTS dispute_raised_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS freight_cost_usd  NUMERIC(14,2);

-- Freight-cost history is queried per origin/destination route when
-- benchmarking a new rate — index the pair to keep that lookup fast.
CREATE INDEX IF NOT EXISTS idx_shipments_route_freight
  ON shipments (origin_country, destination_port)
  WHERE freight_cost_usd IS NOT NULL;
