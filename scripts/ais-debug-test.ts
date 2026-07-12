/**
 * scripts/ais-debug-test.ts
 *
 * THROWAWAY DIAGNOSTIC — not part of the app, not imported anywhere.
 *
 * Isolates one question: is the aisstream.io connection + API key actually
 * receiving ANY live traffic at all? The real ais-worker.ts subscribes with
 * FiltersShipMMSI locked to whatever vessels are on active shipments — which
 * means "zero messages" there is ambiguous between "connection is broken"
 * and "that one specific vessel just hasn't reported recently." This script
 * removes that ambiguity by subscribing to the Singapore Strait — one of the
 * busiest shipping lanes on Earth, with dense terrestrial AIS receiver
 * coverage — with NO MMSI filter at all. If this doesn't produce messages
 * within a few seconds, the problem is the connection/key/subscription
 * itself, not vessel coverage.
 *
 * USAGE:
 *   npx tsx scripts/ais-debug-test.ts
 *
 * Exits automatically after 20 seconds or 10 messages, whichever comes first.
 */

import WebSocket from 'ws';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const AISSTREAM_API_KEY = process.env.AISSTREAM_API_KEY ?? '';
const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';

if (!AISSTREAM_API_KEY) {
  console.error('❌ AISSTREAM_API_KEY is not set in .env.local');
  process.exit(1);
}

console.log('─────────────────────────────────────────');
console.log('  AIS connectivity debug test');
console.log('  Subscribing to entire PH archipelago + EEZ, no MMSI filter, 45s window');
console.log('─────────────────────────────────────────');

const socket = new WebSocket(AISSTREAM_URL);
let messageCount = 0;
let positionReportCount = 0;
const messageTypeCounts: Record<string, number> = {};

socket.on('open', () => {
  console.log('[debug] Socket opened. Sending subscription…');
  const subscriptionMessage = {
    APIKey: AISSTREAM_API_KEY,
    // Whole-Philippines bounding box (roughly the archipelago + EEZ margin) —
    // deliberately wide instead of guessing at a small box from a low-res
    // coverage-map screenshot, which missed twice in a row (Manila Bay/Verde
    // Island Passage, then a tighter Batangas box). This removes the
    // coordinate-guessing problem: if aisstream has ANY station coverage
    // anywhere in the Philippines, a box this size should catch it.
    BoundingBoxes: [[[4.5, 116.0], [21.0, 127.0]]],
    // No FilterMessageTypes / FiltersShipMMSI — deliberately unfiltered so
    // we see every message type that arrives, not just PositionReport.
  };
  socket.send(JSON.stringify(subscriptionMessage));
  console.log('[debug] Subscription sent:', JSON.stringify(subscriptionMessage));
});

socket.on('message', (raw: WebSocket.RawData) => {
  messageCount++;
  try {
    const msg = JSON.parse(raw.toString());
    const type = msg?.MessageType ?? 'UNKNOWN';
    messageTypeCounts[type] = (messageTypeCounts[type] ?? 0) + 1;
    if (type === 'PositionReport') {
      positionReportCount++;
      const mmsi = msg?.MetaData?.MMSI ?? msg?.Message?.PositionReport?.UserID;
      const name = msg?.MetaData?.ShipName?.trim();
      console.log(`[debug] PositionReport #${positionReportCount} — MMSI ${mmsi}${name ? ` (${name})` : ''}`);
    } else {
      console.log(`[debug] Message #${messageCount} — type: ${type}`);
    }
  } catch (err) {
    console.warn('[debug] Failed to parse message:', err);
  }

  if (messageCount >= 10) finish('received 10 messages');
});

socket.on('error', (err: Error) => {
  console.error('[debug] Socket error:', err.message);
});

socket.on('close', (code: number, reason: Buffer) => {
  console.warn(`[debug] Socket closed — code ${code}${reason?.length ? `, reason: ${reason.toString()}` : ''}`);
});

function finish(why: string) {
  console.log('─────────────────────────────────────────');
  console.log(`[debug] Finished (${why}).`);
  console.log(`[debug] Total messages received: ${messageCount}`);
  console.log(`[debug] PositionReport count: ${positionReportCount}`);
  console.log(`[debug] Message type breakdown:`, messageTypeCounts);
  if (messageCount === 0) {
    console.log('[debug] ⚠️  ZERO messages received at all, even unfiltered in one of the');
    console.log('[debug]     busiest straits on Earth. This points to a connection, API key,');
    console.log('[debug]     or subscription-format problem — not vessel coverage.');
  } else {
    console.log('[debug] ✅ Connection is healthy and receiving live AIS traffic.');
    console.log('[debug]     If the real ais-worker still shows nothing for your test MMSI,');
    console.log('[debug]     the issue is specific to that vessel not being in aisstream\'s');
    console.log('[debug]     terrestrial coverage right now, not the worker/connection itself.');
  }
  console.log('─────────────────────────────────────────');
  socket.close();
  process.exit(0);
}

setTimeout(() => finish('45s timeout'), 45_000);
