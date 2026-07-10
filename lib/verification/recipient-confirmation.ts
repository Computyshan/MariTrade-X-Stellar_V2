/**
 * lib/verification/recipient-confirmation.ts
 *
 * Phase 3 — Recipient-side confirmation flow.
 *
 * The "proof" that cargo arrived shouldn't come solely from the logistics
 * side. When ARRIVED_AT_DELIVERY_ADDRESS is approaching (or just logged),
 * the assigned Freight Forwarder or the Importer can send the named
 * consignee a one-time link (this module mints the token) to confirm or
 * dispute receipt from their own device — independent corroboration.
 *
 * No SMS/email provider is wired by default. sendConfirmationLink() logs the
 * link to the server console (visible in dev / server logs) so the flow is
 * fully testable end-to-end without a paid provider, and degrades the same
 * way every other unconfigured integration in this codebase does: the
 * request is still created and the link still works if someone has it.
 * Wire a real provider (Twilio, SendGrid, etc.) by filling in the TODO.
 */

import crypto from 'crypto';

/** Cryptographically random, URL-safe confirmation token. */
export function generateConfirmationToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/** 6-digit OTP for tying a signature/confirmation to the recipient's contact. */
export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Masks a phone number or email for display/audit without exposing the
 *  full contact — e.g. "+63 917 123 4567" -> "+63 9** *** **67",
 *  "jane@example.com" -> "j***@example.com". */
export function maskContact(contact: string): string {
  const trimmed = contact.trim();
  if (trimmed.includes('@')) {
    const [user, domain] = trimmed.split('@');
    if (user.length <= 1) return `*@${domain}`;
    return `${user[0]}${'*'.repeat(Math.max(user.length - 1, 1))}@${domain}`;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 4) return '*'.repeat(trimmed.length);
  const last2 = digits.slice(-2);
  return `${trimmed.slice(0, 3)}${'*'.repeat(Math.max(trimmed.length - 5, 3))}${last2}`;
}

/**
 * Best-effort delivery of the confirmation link / OTP to the consignee.
 * Never throws — a delivery failure must not block the request from being
 * created, since the link itself still works if shared any other way.
 */
export async function sendConfirmationLink(params: {
  consigneeContact: string;
  consigneeName?: string;
  referenceCode: string;
  confirmUrl: string;
}): Promise<{ delivered: boolean; channel: 'sms' | 'email' | 'none'; note?: string }> {
  const { consigneeContact, consigneeName, referenceCode, confirmUrl } = params;
  const isEmail = consigneeContact.includes('@');

  // TODO: wire a real SMS/email provider here (Twilio / SendGrid / etc.),
  // gated on env vars the same way AIS_API_URL is in ais-tracking.ts.
  console.log(
    `[recipient-confirmation] ${isEmail ? 'Email' : 'SMS'} to ${consigneeContact}` +
    `${consigneeName ? ` (${consigneeName})` : ''} for shipment ${referenceCode}: ` +
    `Please confirm delivery at ${confirmUrl}`
  );

  return {
    delivered: false,
    channel: 'none',
    note: 'No SMS/email provider configured — link was logged server-side only. Share it with the consignee directly for now.',
  };
}
