import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { canAccessShipmentVault } from '@/lib/server/vault-access';

// The vault page is open to every job role now — each folder's password is
// the real gate on its documents. What scopes visibility here is whether the
// caller is actually a party to that specific shipment (importer, exporter,
// an assigned logistics user, or a firm teammate of any of those), so people
// only ever see folders for shipments they're assigned to.
export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse || !user) return errorResponse ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    // ?shipmentId= shortcut — returns just the single matching folder
    const shipmentId = req.nextUrl.searchParams.get('shipmentId');
    if (shipmentId) {
      if (!(await canAccessShipmentVault(user.id, shipmentId))) {
        return NextResponse.json({ success: false, error: 'You do not have access to this shipment\'s vault.' }, { status: 403 });
      }
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

    // Only keep folders whose shipment the caller is actually a party to.
    const accessFlags = await Promise.all(
      folders.map(folder => canAccessShipmentVault(user.id, folder.shipmentId))
    );
    const visibleFolders = folders.filter((_, i) => accessFlags[i]);

    const decorated = visibleFolders.map(folder => {
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
