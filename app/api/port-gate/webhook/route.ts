/**
 * /api/port-gate/webhook
 *
 * Phase 5 — Direct System Integration, inbound side. A terminal operating
 * system (TOS) posts here whenever a container gates out of the origin
 * terminal or gates in at the destination terminal, so
 * CONTAINER_GATED_OUT_ORIGIN / CONTAINER_GATED_IN_DESTINATION can be backed
 * by a verified terminal event instead of manual entry.
 *
 * Public endpoint (no user session — the caller is a terminal system, not a
 * browser), authenticated instead by an HMAC-SHA256 signature over the raw
 * body using a shared secret configured per terminal — see
 * lib/integrations/port-gate.ts and PORT_GATE_WEBHOOK_SECRETS. This mirrors
 * how /api/iot/webhook authenticates devices by a shared secret rather than
 * a user JWT.
 *
 * Headers: X-PortGate-Signature: sha256=<hex hmac of the raw body>
 * Body: {
 *   shipmentReferenceCode: string,
 *   terminalCode: string,
 *   eventType: 'GATE_OUT_ORIGIN' | 'GATE_IN_DESTINATION',
 *   containerNumber: string,
 *   occurredAt?: string,   // terminal's own event timestamp, defaults to now
 * }
 *
 * This endpoint only records the event and nudges the assigned Freight
 * Forwarder(s) to confirm it — it does not write a MilestoneEvent directly,
 * since milestone_events.logged_by_id is a real user FK and there's no
 * authenticated user in an inbound webhook call. The actual auto-population
 * happens when a Freight Forwarder next logs the matching milestone type —
 * see the CONTAINER_GATED_* handling in
 * app/api/shipments/[id]/milestones/route.ts, which looks up and attaches
 * any matching unmatched PortGateEvent as SYSTEM_VERIFIED evidence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { notifyUsers } from '@/lib/notify';
import { PortGateEvent, PortGateEventType } from '@/types';
import { isTerminalConfigured, verifyPortGateWebhookSignature } from '@/lib/integrations/port-gate';

const VALID_EVENT_TYPES: PortGateEventType[] = ['GATE_OUT_ORIGIN', 'GATE_IN_DESTINATION'];

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-portgate-signature');

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { shipmentReferenceCode, terminalCode, eventType, containerNumber, occurredAt } = body;

    if (!shipmentReferenceCode || !terminalCode || !containerNumber) {
      return NextResponse.json(
        { success: false, error: 'shipmentReferenceCode, terminalCode, and containerNumber are required.' },
        { status: 400 }
      );
    }
    if (!VALID_EVENT_TYPES.includes(eventType)) {
      return NextResponse.json(
        { success: false, error: `eventType must be one of ${VALID_EVENT_TYPES.join(', ')}.` },
        { status: 400 }
      );
    }

    if (!isTerminalConfigured(terminalCode)) {
      // Deliberately vague — same response whether the terminal code is
      // unknown or just not yet onboarded, so this endpoint never confirms
      // which terminal codes are recognized to an unauthenticated caller.
      return NextResponse.json({ success: false, error: 'Terminal not recognized.' }, { status: 401 });
    }
    if (!verifyPortGateWebhookSignature(terminalCode, rawBody, signature)) {
      return NextResponse.json({ success: false, error: 'Invalid signature.' }, { status: 401 });
    }

    const shipment = await dbStore.getShipmentById(shipmentReferenceCode);
    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment not found.' }, { status: 404 });
    }

    const event: Omit<PortGateEvent, 'id'> = {
      shipmentId: shipment.id,
      terminalCode,
      eventType,
      containerNumber,
      occurredAt: occurredAt ?? new Date().toISOString(),
      receivedAt: new Date().toISOString(),
    };

    const saved = await dbStore.savePortGateEvent(event);

    // Nudge the assigned Freight Forwarder(s) to confirm the milestone —
    // best-effort, never blocks the webhook response.
    try {
      const assignments = await dbStore.getAssignmentsForShipment(shipment.id);
      const milestoneLabel = eventType === 'GATE_OUT_ORIGIN' ? 'gated out of origin' : 'gated in at destination';
      await notifyUsers(assignments.map(a => a.userId), {
        type: 'SHIPMENT_STATUS_CHANGE',
        title: 'Container gate event received',
        body: `Container ${containerNumber} on ${shipment.referenceCode} was just ${milestoneLabel} per ${terminalCode}. Confirm the milestone to attach it as verified evidence.`,
        linkHref: `/shipments/${shipment.id}`,
      });
    } catch (err) {
      console.warn('[port-gate webhook] Failed to notify assigned users, continuing:', err);
    }

    return NextResponse.json({ success: true, data: saved });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
