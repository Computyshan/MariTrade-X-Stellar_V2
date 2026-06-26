import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

// CRITICAL FIX: added authentication guard
export async function GET(req: NextRequest) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const [folders, shipments, documents] = await Promise.all([
      dbStore.getVaultFolders(),
      dbStore.getShipments(),
      dbStore.getDocuments(),
    ]);

    const decorated = folders.map(folder => {
      const shipment = shipments.find(s => s.id === folder.shipmentId) ?? null;
      const docs = documents.filter(d => d.shipmentId === folder.shipmentId);

      // CRITICAL FIX: never return plaintext password to the client
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...safeFolder } = folder;

      return { ...safeFolder, shipment, documents: docs };
    });

    // Sort newest first
    decorated.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ success: true, data: decorated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
