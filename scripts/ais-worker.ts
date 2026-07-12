/**
 * scripts/ais-worker.ts
 *
 * Standalone AIS ingestion worker — NOT part of the Next.js app.
 *
 * WHY THIS EXISTS AS A SEPARATE PROCESS:
 * aisstream.io is a persistent WebSocket stream (wss://stream.aisstream.io/v0/stream).
 * You connect once, send a subscription message, and it pushes PositionReport
 * messages continuously for as long as the socket stays open. There is no
 * per-request "give me vessel X's position" endpoint — so it cannot be called
 * from inside a Next.js API route (those are short-lived request/response
 * functions with nowhere for a long-lived socket to live).
 *
 * This script holds that connection instead, and upserts the latest position
 * per MMSI into the `ais_vessel_positions` table. The app (via
 * lib/verification/ais-tracking.ts) only ever reads that cache.
 *
 * WHAT IT WATCHES:
 * Only MMSIs that are actually set on an active (non-terminal) shipment
 * (Shipment.vesselMmsi — set by a Freight Forwarder alongside the
 * SPACE_ON_VESSEL_SECURED milestone). The watched-list is re-polled from the
 * DB every REFRESH_INTERVAL_MS and, if it changed, the socket is reconnected
 * with an updated subscription (aisstream's filters are set at subscribe
 * time, so there's no way to add an MMSI to a live subscription).
 *
 * USAGE (run this in its own terminal/process — it is NOT started by
 * `next dev` / `next start`):
 *   npx tsx scripts/ais-worker.ts
 *
 * For a real deployment this should run as a small long-lived service
 * (a separate Railway/Fly/Render worker, a systemd unit, a PM2 process,
 * etc.) — not inside the same serverless deployment as the Next.js app.
 *
 * PREREQUISITES:
 *   - AISSTREAM_API_KEY set in .env.local (your aisstream.io key)
 *   - SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL set in .env.local
 */

import WebSocket from 'ws';
import * as dotenv from 'dotenv';
import * as path from 'path';

// dotenv MUST run before lib/supabase.ts is ever imported/evaluated — that
// module reads process.env.NEXT_PUBLIC_SUPABASE_URL / ANON_KEY at module top
// level and throws immediately if they're unset. A static
// `import { getSupabaseAdmin } from '../lib/supabase'` here would get
// hoisted above this dotenv.config() call in the compiled output (ES/CJS
// imports always run before other top-level statements in the same file,
// regardless of the order they're written in source), so lib/supabase.ts
// would throw "Missing Supabase env vars" before .env.local had ever been
// loaded — even though dotenv.config() appears right below the imports. A
// dynamic import() inside main(), after dotenv.config() has run, avoids that.
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

let getSupabaseAdmin: typeof import('../lib/supabase').getSupabaseAdmin;

const AISSTREAM_API_KEY = process.env.AISSTREAM_API_KEY ?? '';
const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';

const REFRESH_INTERVAL_MS = 2 * 60 * 1000; // re-poll watched MMSIs every 2 min
const RECONNECT_DELAY_MS = 5000;

// Common IMO/AIS navigational status codes worth naming explicitly — anything
// else just gets logged as "status <code>" rather than silently dropped.
const NAV_STATUS_LABELS: Record<number, string> = {
  0: 'under way using engine',
  1: 'at anchor',
  2: 'not under command',
  3: 'restricted manoeuvrability',
  5: 'moored',
  6: 'aground',
  8: 'under way sailing',
};

function navStatusLabel(code: unknown): string | undefined {
  if (typeof code !== 'number') return typeof code === 'string' ? code : undefined;
  return NAV_STATUS_LABELS[code] ?? `status ${code}`;
}

/**
 * aisstream.io sends MetaData.time_utc in Go's default time.Time String()
 * format, e.g. "2026-07-11 12:36:28.248331258 +0000 UTC" — nanosecond
 * precision, space-separated, with a literal "UTC" suffix trailing the
 * numeric offset. Postgres's timestamptz parser rejects that combination
 * ("invalid input syntax for type timestamp with time zone") even though it
 * looks like a normal timestamp, so every upsert was failing silently into
 * the DB (loudly into the terminal, but nothing ever reached Supabase).
 * This reshapes it into valid ISO 8601 (millisecond precision, trailing Z)
 * before it's ever sent to Supabase. Falls back to "now" if the format ever
 * changes unexpectedly — never worth blocking the upsert over a timestamp
 * we can't parse.
 */
function parseAisTimestamp(raw: string | undefined): string {
  if (!raw) return new Date().toISOString();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?/);
  if (!match) return new Date().toISOString();
  const [, datePart, timePart, fracPart] = match;
  const millis = fracPart ? fracPart.slice(1, 4).padEnd(3, '0') : '000'; // ns → ms, truncated not rounded
  return `${datePart}T${timePart}.${millis}Z`;
}

async function getWatchedMmsis(): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('shipments')
    .select('vessel_mmsi')
    .not('vessel_mmsi', 'is', null)
    .not('status', 'in', '(DELIVERED,CANCELLED,DISPUTED)');
  if (error) {
    console.error('[ais-worker] Failed to fetch watched MMSIs:', error.message);
    return [];
  }
  return Array.from(new Set((data ?? []).map((r: any) => r.vessel_mmsi as string).filter(Boolean)));
}

async function upsertPosition(pos: {
  mmsi: string;
  shipName?: string;
  imoNumber?: string;
  latitude?: number;
  longitude?: number;
  sogKnots?: number;
  navStatus?: string;
  receivedAt: string;
}) {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('ais_vessel_positions')
    .upsert(
      {
        mmsi: pos.mmsi,
        ship_name: pos.shipName ?? null,
        imo_number: pos.imoNumber ?? null,
        latitude: pos.latitude ?? null,
        longitude: pos.longitude ?? null,
        sog_knots: pos.sogKnots ?? null,
        nav_status: pos.navStatus ?? null,
        received_at: pos.receivedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'mmsi' },
    );
  if (error) console.error(`[ais-worker] Failed to upsert position for MMSI ${pos.mmsi}:`, error.message);
}

let socket: WebSocket | null = null;
let currentMmsis: string[] = [];
let shuttingDown = false;

function connect(mmsis: string[]) {
  if (socket) {
    socket.removeAllListeners();
    try { socket.close(); } catch { /* already closing */ }
  }

  if (mmsis.length === 0) {
    console.log('[ais-worker] No vessels currently watched (no shipment has a vesselMmsi set yet). Waiting…');
  }

  console.log(`[ais-worker] Connecting to aisstream.io — watching ${mmsis.length} vessel(s): ${mmsis.join(', ') || '(none yet)'}`);
  socket = new WebSocket(AISSTREAM_URL);

  socket.on('open', () => {
    // Must send the subscription within 3 seconds of connecting or
    // aisstream.io closes the socket.
    const subscriptionMessage: Record<string, unknown> = {
      APIKey: AISSTREAM_API_KEY,
      // Global bounding box — we filter by MMSI below instead of by area,
      // since our watched vessels could be anywhere.
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FilterMessageTypes: ['PositionReport'],
    };
    // Only add the MMSI filter if we have vessels to watch — an empty array
    // here would mean "no messages ever", which is fine while idle, but we
    // still want the socket open so it's ready the instant a shipment gets
    // a vesselMmsi set (caught by the next refresh cycle).
    if (mmsis.length > 0) subscriptionMessage.FiltersShipMMSI = mmsis;
    socket!.send(JSON.stringify(subscriptionMessage));
    console.log('[ais-worker] Subscription sent.');
  });

  socket.on('message', async (raw: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg?.MessageType !== 'PositionReport') return;

      const pr = msg.Message?.PositionReport;
      const meta = msg.MetaData;
      const mmsi = String(meta?.MMSI ?? pr?.UserID ?? '');
      if (!mmsi) return;

      await upsertPosition({
        mmsi,
        shipName: meta?.ShipName?.trim() || undefined,
        latitude: typeof pr?.Latitude === 'number' ? pr.Latitude : undefined,
        longitude: typeof pr?.Longitude === 'number' ? pr.Longitude : undefined,
        sogKnots: typeof pr?.Sog === 'number' ? pr.Sog : undefined,
        navStatus: navStatusLabel(pr?.NavigationalStatus),
        receivedAt: parseAisTimestamp(meta?.time_utc),
      });
      console.log(`[ais-worker] Position update — MMSI ${mmsi}${meta?.ShipName ? ` (${meta.ShipName})` : ''}: ${pr?.Latitude}, ${pr?.Longitude} @ ${pr?.Sog ?? '?'} kn`);
    } catch (err) {
      console.warn('[ais-worker] Failed to process a message, skipping:', err);
    }
  });

  socket.on('close', (code: number, reason: Buffer) => {
    if (shuttingDown) return;
    console.warn(`[ais-worker] Socket closed (code ${code}${reason?.length ? `, ${reason.toString()}` : ''}) — reconnecting in ${RECONNECT_DELAY_MS / 1000}s…`);
    setTimeout(() => connect(currentMmsis), RECONNECT_DELAY_MS);
  });

  socket.on('error', (err: Error) => {
    console.error('[ais-worker] Socket error:', err.message);
  });
}

async function main() {
  // Resolve the deferred import now that dotenv.config() has already run —
  // see the comment above the `let getSupabaseAdmin` declaration for why
  // this can't just be a normal top-of-file import.
  ({ getSupabaseAdmin } = await import('../lib/supabase'));

  if (!AISSTREAM_API_KEY) {
    console.error('❌ AISSTREAM_API_KEY is not set in .env.local — get one at https://aisstream.io and add it there.');
    process.exit(1);
  }

  console.log('─────────────────────────────────────────');
  console.log('  MariTrade AIS Worker');
  console.log('─────────────────────────────────────────');

  currentMmsis = await getWatchedMmsis();
  connect(currentMmsis);

  // Periodically check whether the set of watched vessels changed (a new
  // shipment got a vesselMmsi, or one reached a terminal state) and only
  // reconnect if it actually did — reconnecting on every tick would be
  // needlessly disruptive.
  setInterval(async () => {
    const next = await getWatchedMmsis();
    const changed =
      next.length !== currentMmsis.length ||
      next.some(m => !currentMmsis.includes(m));
    if (changed) {
      console.log('[ais-worker] Watched vessel set changed — reconnecting with updated subscription.');
      currentMmsis = next;
      connect(currentMmsis);
    }
  }, REFRESH_INTERVAL_MS);
}

process.on('SIGINT', () => {
  shuttingDown = true;
  console.log('\n[ais-worker] Shutting down…');
  socket?.close();
  process.exit(0);
});

main();
