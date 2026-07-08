import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { canAccessShipmentVault } from '@/lib/server/vault-access';

type Ctx = { params: Promise<{ folderId: string }> };

// ─── GET /api/vault/folders/[folderId] ───────────────────────────────────────
// Returns folder metadata + its shipment_documents.
// Password is NEVER sent to the client.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse || !user) return errorResponse ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const { folderId } = await params;
    const folder = await dbStore.getVaultFolderById(folderId);
    if (!folder) {
      return NextResponse.json(
        { success: false, error: 'Vault folder not found' },
        { status: 404 },
      );
    }

    // Only a party to this shipment (importer, exporter, assigned logistics
    // user, or a firm teammate of any of those) may even see this folder.
    if (!(await canAccessShipmentVault(user.id, folder.shipmentId))) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this shipment\'s vault.' },
        { status: 403 },
      );
    }

    const [documents, shipment] = await Promise.all([
      dbStore.getDocuments(folder.shipmentId),
      dbStore.getShipmentById(folder.shipmentId),
    ]);

    // Strip the plaintext password — never expose it to the client
    const { password: _password, ...safeFolder } = folder;

    return NextResponse.json({
      success: true,
      data: { ...safeFolder, shipment: shipment ?? null, documents },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST /api/vault/folders/[folderId] ──────────────────────────────────────
// action: 'verify_password' — checks the submitted password server-side.
// Returns { success: true } on match, { success: false } on mismatch.
// The plaintext password is NEVER returned to the client.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse || !user) return errorResponse ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const { folderId } = await params;
    const body = await req.json();
    const { action, password } = body;

    if (action !== 'verify_password') {
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}` },
        { status: 400 },
      );
    }

    const folder = await dbStore.getVaultFolderById(folderId);
    if (!folder) {
      return NextResponse.json(
        { success: false, error: 'Vault folder not found' },
        { status: 404 },
      );
    }

    // Only a party to this shipment may attempt the vault password at all.
    if (!(await canAccessShipmentVault(user.id, folder.shipmentId))) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this shipment\'s vault.' },
        { status: 403 },
      );
    }

    const ok = typeof password === 'string' && password === folder.password;
    return NextResponse.json({ success: ok });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
