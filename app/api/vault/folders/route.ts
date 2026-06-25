import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';

/**
 * GET /api/vault/folders
 *
 * Returns all BOC Document Vault folders, each decorated with their
 * associated shipment documents and shipment metadata.
 *
 * The password field IS returned — comparison is done client-side in
 * this demo. In production, replace with a POST /verify endpoint that
 * compares against a server-side hash and returns a signed session token.
 */
export async function GET(_req: NextRequest) {
  try {
    const folders   = dbStore.getVaultFolders();
    const shipments = dbStore.getShipments();
    const documents = dbStore.getDocuments();

    const decorated = folders.map(folder => {
      const shipment = shipments.find(s => s.id === folder.shipmentId) ?? null;
      const docs     = documents.filter(d => d.shipmentId === folder.shipmentId);

      return {
        ...folder,
        shipment,
        documents: docs,
      };
    });

    // Sort newest first
    decorated.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ success: true, data: decorated });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
