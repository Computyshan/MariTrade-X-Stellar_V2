import { JobRole } from '../../types';

export function canAccessBOCDocuments(jobRole: JobRole): boolean {
  if (
    jobRole === 'IMPORTER' ||
    jobRole === 'EXPORTER' ||
    jobRole === 'COMPANY_OWNER' ||
    jobRole === 'TRADER' ||
    jobRole === 'CUSTOMS_BROKER'
  ) {
    return true;
  }
  return false;
}

export function canDownloadDocuments(jobRole: JobRole): boolean {
  if (
    jobRole === 'IMPORTER' ||
    jobRole === 'EXPORTER' ||
    jobRole === 'COMPANY_OWNER' ||
    jobRole === 'TRADER' ||
    jobRole === 'CUSTOMS_BROKER'
  ) {
    return true;
  }
  return false;
}

export function canUploadDocuments(jobRole: JobRole): boolean {
  if (
    jobRole === 'IMPORTER' ||
    jobRole === 'EXPORTER' ||
    jobRole === 'COMPANY_OWNER' ||
    jobRole === 'TRADER' ||
    jobRole === 'CUSTOMS_BROKER'
  ) {
    return true;
  }
  return false;
}
