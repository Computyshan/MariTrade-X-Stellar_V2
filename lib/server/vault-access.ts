import { dbStore } from '../db';

/**
 * SERVER-ONLY. This hits `dbStore`, which uses the Supabase service-role
 * admin client — never import this file from a 'use client' component. It
 * belongs in API routes / server actions only.
 *
 * A caller may see/act on a vault folder only if they're a party to the
 * underlying shipment: the importer, the exporter, an assigned logistics
 * user, or a firm teammate of any of those (mirrors the scoping already used
 * in GET /api/shipments). This is what actually determines which folders a
 * given user sees in the vault — not their job role. Download and upload
 * access mirror this too: there's no additional role gate on top of
 * assignment, so anyone who can open a folder can also download from it and
 * upload to it.
 */
export async function canAccessShipmentVault(userId: string, shipmentId: string): Promise<boolean> {
  const [shipment, me, assignments] = await Promise.all([
    dbStore.getShipmentById(shipmentId),
    dbStore.getUserById(userId),
    dbStore.getAssignmentsForShipment(shipmentId),
  ]);
  if (!shipment || !me) return false;

  const teammateFirmId = me.firmId ?? null;

  const isDirectParty =
    shipment.importerId === userId ||
    shipment.exporterId === userId ||
    assignments.some(a => a.userId === userId);
  if (isDirectParty) return true;

  // Firm-teammate check: is a teammate the importer/exporter/assignee?
  if (!teammateFirmId) return false;
  const relevantIds = [shipment.importerId, shipment.exporterId, ...assignments.map(a => a.userId)]
    .filter((id): id is string => Boolean(id));
  if (relevantIds.length === 0) return false;

  const relevantUsers = await Promise.all(relevantIds.map(id => dbStore.getUserById(id)));
  return relevantUsers.some(u => u?.firmId === teammateFirmId);
}
