// ─── Phase 4 · ETA countdown formatting ──────────────────────────────────
// Extracted from app/(dashboard)/shipments/[id]/page.tsx so it can be unit
// tested and reused wherever a shipment ETA needs a human countdown label.

export type EtaCountdown = { label: string; overdue: boolean };

export function formatEtaCountdown(estimatedArrival: string, nowMs: number): EtaCountdown {
  const targetMs = new Date(estimatedArrival).getTime();
  const diffMs = targetMs - nowMs;
  const overdue = diffMs < 0;
  const abs = Math.abs(diffMs);
  const days = Math.floor(abs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((abs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((abs % (60 * 60 * 1000)) / (60 * 1000));
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  if (days === 0) parts.push(`${minutes}m`);
  const duration = parts.join(' ');
  return {
    label: overdue ? `${duration} past ETA` : `${duration} until ETA`,
    overdue,
  };
}
