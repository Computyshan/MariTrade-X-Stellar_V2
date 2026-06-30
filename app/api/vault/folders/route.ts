import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

// CRITICAL FIX: added authentication guard
export async function GET(req: NextRequest) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    // ?shipmentId= shortcut — returns just the single matching folder
    const shipmentId = req.nextUrl.searchParams.get('shipmentId');
    if (shipmentId) {
      const folder = await dbStore.getVaultFolderByShipmentId(shipmentId);
      if (!folder) {
        return NextResponse.json({ success: false, error: 'Vault folder not found for this shipment' }, { status: 404 });
      }
      const { password: _pw, ...safeFolder } = folder;
      return NextResponse.json({ success: true, data: safeFolder });
    }

    const [folders, shipments, documents] = await Promise.all([
      dbStore.getVaultFolders(),
      dbStore.getShipments(),
      dbStore.getDocuments(),
    ]);

    const decorated = folders.map(folder => {
      const shipment = shipments.find(s => s.id === folder.shipmentId) ?? null;
      const docs = documents.filter(d => d.shipmentId === folder.shipmentId);

      // CRITICAL FIX: never return plaintext password to the client
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
