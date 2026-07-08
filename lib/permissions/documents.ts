import { JobRole } from '../../types';

/**
 * The BOC Document Vault page itself is open to every job role — a vault
 * password already gates the actual documents inside each folder, so a
 * role-based wall in front of the folder list is redundant.
 *
 * What actually scopes visibility (and, mirroring it, download/upload
 * access) is whether the caller is a party to a *specific* shipment —
 * importer, exporter, an assigned logistics user, or a firm teammate of any
 * of those. That check lives server-side in
 * `lib/server/vault-access.ts::canAccessShipmentVault`, since it needs the
 * database. It is NOT re-exported from this file, because this file is safe
 * to import from client ('use client') components and that one is not.
 */
export function canAccessBOCDocuments(_jobRole: JobRole): boolean {
  return true;
}
