/**
 * GET /api/cron/delay-monitor
 *
 * Phase 4 — Congestion/backlog alerts + Proactive delay disclosure.
 *
 * Triggered on a schedule by Vercel Cron (see vercel.json) rather than a
 * standalone long-running process — this is a "check periodically, compare
 * against DB state, notify if changed" job, not a persistent stream like
 * scripts/ais-worker.ts, so it fits the same request/response model as
 * every other route in this app instead of needing its own deploy target.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` on every
 * invocation when CRON_SECRET is set (see .env.example) — this route
 * rejects any request that doesn't present that exact header, so it can't
 * be triggered by an arbitrary caller who finds the URL.
 *
 * For each active (non-terminal) shipment:
 *   1. Poll lib/delay-signals.ts for port-congestion + customs-backlog
 *      signals against that shipment's lane. Both checks are no-ops
 *      ({ detected: false }) until a real provider is configured — see
 *      that file's header comment.
 *   2. If a signal is detected AND the most recent alert for this
 *      shipment+source is either absent or older than ALERT_COOLDOWN_MS,
 *      write a new shipment_delay_alerts row and notify:
 *        - every assigned Logistics Chain user (congestion/backlog alert)
 *        - the importer (proactive delay disclosure) — independently of
 *          whether any logistics user has logged anything yet
 *   3. If a signal is detected but within the cooldown of the last alert,
 *      skip — this is the same ongoing condition, not a new nudge.
 *
 * This route intentionally does NOT implement "SLA countdown surfacing" —
 * that's a live, client-side countdown (see the shipment detail page),
 * not something that needs server-side polling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { notifyUser, notifyUsers } from '@/lib/notify';
import { checkPortCongestion, checkCustomsBacklog } from '@/lib/delay-signals';
import { DelaySignalSource } from '@/types';

const ALERT_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12h — re-alert if the condition persists past this

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // No secret configured — refuse to run rather than operate wide open.
  // (Set CRON_SECRET in .env.local / your Vercel project env vars.)
  if (!secret) return false;
  const authHeader = req.headers.get('authorization');
  return authHeader === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const shipments = await dbStore.getActiveShipmentsForDelayMonitoring();

  let checked = 0;
  let alertsCreated = 0;
  const errors: string[] = [];

  for (const shipment of shipments) {
    checked++;
    try {
      const signals: { source: DelaySignalSource; result: Awaited<ReturnType<typeof checkPortCongestion>> }[] = [
        { source: 'PORT_CONGESTION', result: await checkPortCongestion(shipment.destinationPort) },
        { source: 'CUSTOMS_BACKLOG', result: await checkCustomsBacklog(shipment.originCountry, shipment.destinationPort) },
      ];

      for (const { source, result } of signals) {
        if (!result.detected) continue;

        const recent = await dbStore.getRecentDelayAlert(shipment.id, source);
        if (recent && Date.now() - new Date(recent.detectedAt).getTime() < ALERT_COOLDOWN_MS) {
          continue; // same ongoing condition — don't spam
        }

        const now = new Date().toISOString();
        await dbStore.saveDelayAlert({
          shipmentId: shipment.id,
          source,
          severity: result.severity ?? 'ADVISORY',
          summary: result.summary ?? 'A delay-risk signal was detected for this shipment.',
          detail: result.detail,
          detectedAt: now,
          notifiedLogisticsAt: now,
          notifiedImporterAt: now,
        });
        alertsCreated++;

        // Notify assigned Logistics Chain users — the detail line, since
        // they're the ones acting on it.
        const assignments = await dbStore.getAssignmentsForShipment(shipment.id);
        await notifyUsers(
          assignments.map(a => a.userId),
          {
            type: 'PORT_CONGESTION_ALERT',
            title: result.severity === 'WARNING' ? 'Delay risk: action recommended' : 'Delay risk advisory',
            body: result.summary ?? 'A delay-risk signal was detected for this shipment.',
            linkHref: `/shipments/${shipment.id}`,
          },
        );

        // Proactive delay disclosure to the importer — plain-language,
        // no operational detail, and sent even if no logistics user has
        // logged anything about this yet.
        await notifyUser({
          userId: shipment.importerId,
          type: 'PROACTIVE_DELAY_DISCLOSURE',
          title: 'Possible delay on your shipment',
          body: `${result.summary ?? 'An external signal suggests your shipment may be affected by a delay.'} We'll keep you posted.`,
          linkHref: `/shipments/${shipment.id}`,
        });
      }
    } catch (err: any) {
      errors.push(`${shipment.id}: ${err?.message ?? 'unknown error'}`);
    }
  }

  return NextResponse.json({
    success: true,
    data: { checked, alertsCreated, errors },
  });
}
