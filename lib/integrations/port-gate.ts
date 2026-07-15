/**
 * lib/integrations/port-gate.ts
 *
 * Port/terminal gate system webhook — Phase 5, Direct System Integration.
 * Unlike the other Phase 5 integrations, MariTrade doesn't call *out* to a
 * terminal operating system (TOS) here; the TOS calls *in* to
 * app/api/webhooks/port-gate/route.ts whenever a container gates out of the
 * origin terminal or gates in at the destination terminal. This module holds
 * the shared verification + mapping logic that route uses.
 *
 * SANDBOX NOTE: Terminal operating systems (ICTSI, APM Terminals, etc.) each
 * have their own webhook-signing convention; there's no single public
 * sandbox to build against. The HMAC-SHA256 signature check below is the
 * common-denominator shape most TOS webhook integrations use — swap in the
 * real per-terminal verification scheme once a terminal partner is onboarded.
 * Terminals are configured per-deployment via `PORT_GATE_WEBHOOK_SECRETS`, a
 * JSON map of terminalCode -> shared secret, e.g.:
 *   PORT_GATE_WEBHOOK_SECRETS={"ICTSI_MANILA":"whsec_abc123"}
 * A terminal with no entry in that map is treated as not configured, and the
 * webhook route rejects its events rather than trusting an unverifiable
 * signature — this integration has no silent "manual" fallback of its own
 * since it's inbound-only; the milestone stays manually-loggable regardless.
 */

import crypto from 'crypto';
import { MilestoneType, PortGateEventType } from '../../types';

function getConfiguredSecrets(): Record<string, string> {
  const raw = process.env.PORT_GATE_WEBHOOK_SECRETS;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    console.warn('[port-gate] PORT_GATE_WEBHOOK_SECRETS is not valid JSON — ignoring.');
    return {};
  }
}

export function isTerminalConfigured(terminalCode: string): boolean {
  return Boolean(getConfiguredSecrets()[terminalCode]);
}

/**
 * Verifies an HMAC-SHA256 signature of the raw request body against the
 * shared secret configured for `terminalCode`. Returns false (not throws)
 * for both "wrong signature" and "terminal not configured", so callers
 * can't accidentally leak which case occurred.
 */
export function verifyPortGateWebhookSignature(
  terminalCode: string,
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = getConfiguredSecrets()[terminalCode];
  if (!secret || !signatureHeader) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  // Constant-time comparison to avoid timing side-channels.
  const expectedBuf = Buffer.from(expected, 'hex');
  const givenBuf = Buffer.from(signatureHeader.replace(/^sha256=/, ''), 'hex');
  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
}

/** Maps a raw gate event type to the milestone it auto-populates. */
export function matchPortGateEventToMilestoneType(
  eventType: PortGateEventType
): MilestoneType {
  return eventType === 'GATE_OUT_ORIGIN'
    ? 'CONTAINER_GATED_OUT_ORIGIN'
    : 'CONTAINER_GATED_IN_DESTINATION';
}
