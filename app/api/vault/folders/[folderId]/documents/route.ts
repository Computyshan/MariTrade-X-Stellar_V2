import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { getSupabaseAdmin } from '@/lib/supabase';

type Ctx = { params: Promise<{ folderId: string }> };

const BUCKET = 'vault-documents';

// A caller may act on a vault folder's documents only if they're a party to
// the underlying shipment: the importer, the exporter, an assigned logistics
// user, or a firm teammate of any of those (mirrors the scoping already used
// in GET /api/shipments). Without this, any authenticated MariTrade user
// could upload or delete documents in another party's BOC vault just by
// guessing/knowing a folderId.
async function canAccessShipmentVault(userId: string, shipmentId: string): Promise<boolean> {
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

// ─── POST /api/vault/folders/[folderId]/documents ─────────────────────────────
// Accepts multipart/form-data with a `file` field.
// Uploads to Supabase Storage and inserts a shipment_documents row.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse || !user) return errorResponse ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const { folderId } = await params;

    // 1. Resolve vault folder → get shipmentId
    const folder = await dbStore.getVaultFolderById(folderId);
    if (!folder) {
      return NextResponse.json(
        { success: false, error: 'Vault folder not found' },
        { status: 404 },
      );
    }

    // 1b. Authorization: only parties to this shipment (or their teammates)
    // may upload documents into its vault.
    if (!(await canAccessShipmentVault(user.id, folder.shipmentId))) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this shipment\'s vault.' },
        { status: 403 },
      );
    }

    // 2. Parse the uploaded file
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 },
      );
    }

    // 3. Determine version number (count existing docs with same name)
    const existing = await dbStore.getDocuments(folder.shipmentId);
    const sameNameDocs = existing.filter(d => d.fileName === file.name);
    const version = sameNameDocs.length + 1;

    // 4. Upload to Supabase Storage
    const supabase = getSupabaseAdmin();
    const storagePath = `${folder.shipmentId}/${Date.now()}_v${version}_${file.name}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('[upload] Supabase Storage error:', uploadError.message);
      return NextResponse.json(
        { success: false, error: `Storage error: ${uploadError.message}` },
        { status: 500 },
      );
    }

    // 5. Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    // 6. Save document record (saveDocument handles marking older versions is_latest=false)
    const doc = await dbStore.saveDocument({
      id: '',
      shipmentId: folder.shipmentId,
      fileName: file.name,
      fileUrl: urlData.publicUrl,
      uploadedById: user.id,
      version,
      isLatest: true,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, data: doc });
  } catch (err: any) {
    console.error('[upload] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: err.message ?? 'Upload failed' },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/vault/folders/[folderId]/documents?docId=xxx ────────────────
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse || !user) return errorResponse ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const { folderId } = await params;
    const folder = await dbStore.getVaultFolderById(folderId);
    if (!folder) {
      return NextResponse.json({ success: false, error: 'Vault folder not found' }, { status: 404 });
    }

    // Authorization: only parties to this shipment (or their teammates) may
    // delete documents from its vault.
    if (!(await canAccessShipmentVault(user.id, folder.shipmentId))) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this shipment\'s vault.' },
        { status: 403 },
      );
    }

    const docId = req.nextUrl.searchParams.get('docId');
    if (!docId) {
      return NextResponse.json({ success: false, error: 'docId query param required' }, { status: 400 });
    }

    const docs = await dbStore.getDocuments(folder.shipmentId);
    const target = docs.find(d => d.id === docId);
    if (!target) {
      return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });
    }

    // Remove from Supabase Storage (extract path from public URL)
    const supabase = getSupabaseAdmin();
    const url = new URL(target.fileUrl);
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/vault-documents\/(.+)/);
    if (pathMatch?.[1]) {
      await supabase.storage.from(BUCKET).remove([decodeURIComponent(pathMatch[1])]);
    }

    // Delete DB row
    await supabase.from('shipment_documents').delete().eq('id', docId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
