import { JobRole } from '../../types';

/**
 * All roles can access the BOC Document Vault.
 * Access is secured at the folder level via vault password authorization.
 */
export function canAccessBOCDocuments(_jobRole: JobRole): boolean {
  return true;
}

/**
 * All roles can download documents once they have unlocked a vault folder.
 */
export function canDownloadDocuments(_jobRole: JobRole): boolean {
  return true;
}

/**
 * All roles can upload documents to the vault.
 */
export function canUploadDocuments(_jobRole: JobRole): boolean {
  return true;
}
