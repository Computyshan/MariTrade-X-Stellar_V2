import { JobRole } from '../../types';

/**
 * Only the Customs Broker (plus platform Admins, for support/audit purposes)
 * has read/download access to the full BOC Document Vault. Other Logistics
 * Chain roles (Freight Forwarder, Warehouse Operator) and Trade Party roles
 * (Importer, Exporter) do not.
 */
const BOC_VAULT_ROLES: ReadonlySet<JobRole> = new Set<JobRole>(['CUSTOMS_BROKER', 'ADMIN']);

export function canAccessBOCDocuments(jobRole: JobRole): boolean {
  return BOC_VAULT_ROLES.has(jobRole);
}

/**
 * Download access mirrors vault access — if you can't open the vault folder,
 * you can't download from it either.
 */
export function canDownloadDocuments(jobRole: JobRole): boolean {
  return BOC_VAULT_ROLES.has(jobRole);
}

/**
 * Only the Customs Broker uploads into the BOC vault (they're the one filing
 * with BOC and holding the source documents). Admins retain upload for
 * support/correction purposes.
 */
export function canUploadDocuments(jobRole: JobRole): boolean {
  return BOC_VAULT_ROLES.has(jobRole);
}
