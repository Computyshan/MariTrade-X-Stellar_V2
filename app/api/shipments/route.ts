import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { notifyUser, notifyUsers } from '@/lib/notify';
import { Shipment, PriorityMilestone, ShipmentAssignment, VaultFolder, ShipmentDocument } from '@/types';

export async function GET(req: NextRequest) {
  // CRITICAL FIX: authenticate every request
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const [list, users, assignments] = await Promise.all([
      dbStore.getShipments(),
      dbStore.getUsers(),
      dbStore.getAssignments(),
    ]);

    // Scope to shipments the requester is actually party to: importer,
    // exporter, or an assigned logistics user — plus, for multi-seat firm
    // accounts, any shipment a *teammate* (same firm_id) is party to. dbStore
    // uses the Supabase service-role client (bypasses RLS), so this filtering
    // has to happen here rather than relying on RLS policies alone.
    //
    // ADMIN accounts are never party to any shipment (they don't import,
    // export, or get assigned), so without a bypass this endpoint would
    // always return an empty list for them — breaking the Admin Dashboard's
    // stat cards, dispute counter, and "All Shipments" table. Give ADMIN
    // platform-wide visibility here, same as /api/admin/disputes already does.
    const myUserId = user!.id;
    const me = users.find(u => u.id === myUserId);

    if (me?.userType === 'ADMIN') {
      const decoratedAll = list.map(s => {
        const importer = users.find(u => u.id === s.importerId) || null;
        const exporter = s.exporterId ? (users.find(u => u.id === s.exporterId) || null) : null;
        const shipmentAssignments = assignments
          .filter(a => a.shipmentId === s.id)
          .map(a => {
            const assignedUser = users.find(u => u.id === a.userId) || null;
            return { ...a, user: assignedUser };
          });
        return { ...s, importer, exporter, assignments: shipmentAssignments };
      });
      return NextResponse.json({ success: true, data: decoratedAll });
    }

    const teammateIds = me?.firmId
      ? new Set(users.filter(u => u.firmId === me.firmId).map(u => u.id))
      : new Set([myUserId]);

    const relevantAssignedShipmentIds = new Set(
      assignments.filter(a => teammateIds.has(a.userId)).map(a => a.shipmentId)
    );
    const myShipments = list.filter(s =>
      teammateIds.has(s.importerId) ||
      (s.exporterId ? teammateIds.has(s.exporterId) : false) ||
      relevantAssignedShipmentIds.has(s.id)
    );

    const decoratedList = myShipments.map(s => {
      const importer = users.find(u => u.id === s.importerId) || null;
      const exporter = s.exporterId ? (users.find(u => u.id === s.exporterId) || null) : null;
      const shipmentAssignments = assignments
        .filter(a => a.shipmentId === s.id)
        .map(a => {
          const user = users.find(u => u.id === a.userId) || null;
          return { ...a, user };
        });

      return { ...s, importer, exporter, assignments: shipmentAssignments };
    });

    return NextResponse.json({ success: true, data: decoratedList });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // CRITICAL FIX: authenticate every request
  const { user: authedUser, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const {
      importerId,
      exporterId,
      description,
      originCountry,
      destinationPort,
      shipmentScope,
      totalValueUSD,
      estimatedArrival,
      selectedLogisticsUsers,
      requiredMilestones,
      documents,
      vaultFolderName,
      vaultPassword,
      escrowAsset,
    } = body;

    if (!importerId || !description || !originCountry || !destinationPort || !shipmentScope || !totalValueUSD) {
      return NextResponse.json({ success: false, error: 'Missing required shipment details' }, { status: 400 });
    }

    // A caller may only create a shipment where they themselves are the
    // importer — otherwise any authenticated user could forge shipment
    // records (and downstream escrow state) on behalf of someone else.
    if (importerId !== authedUser!.id) {
      return NextResponse.json(
        { success: false, error: 'You can only create shipments where you are the importer.' },
        { status: 403 },
      );
    }

    // ADMIN accounts are internal platform staff, not trading parties — they
    // have no importer/exporter role from onboarding and aren't meant to
    // hold escrow or appear as a shipment counterparty. The check above only
    // verifies importerId === authedUser.id, which an ADMIN account trivially
    // satisfies by naming itself as importer. Block that here so an ADMIN
    // account can never enter the escrow/dispute machinery as a party.
    const callingUser = await dbStore.getUserById(authedUser!.id);
    if (callingUser?.userType === 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin accounts cannot create shipments.' },
        { status: 403 },
      );
    }

    // Generate reference code: MT-YYYY-NNNNN
    const year = new Date().getFullYear();
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const referenceCode = `MT-${year}-${randomNum}`;
    const newId = 'sh_' + Math.random().toString(36).substring(2, 9);

    const newShipment: Shipment = {
      id: newId,
      referenceCode,
      importerId,
      exporterId: exporterId && exporterId.trim() !== '' ? exporterId : undefined,
      description,
      originCountry,
      destinationPort,
      shipmentScope,
      status: 'ESCROW_FUNDED',
      totalValueUSD: parseFloat(totalValueUSD),
      escrowStatus: 'FUNDED',
      escrowAmountUSD: parseFloat(totalValueUSD),
      escrowAsset: (escrowAsset === 'PPHP' ? 'PPHP' : 'USDC') as 'USDC' | 'PPHP',
      stellarEscrowId: 'G' + Math.random().toString(36).toUpperCase().substring(2, 10) + '...ESCROW_MT' + randomNum,
      estimatedArrival: estimatedArrival || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbStore.saveShipment(newShipment);

    // Save assignments
    if (Array.isArray(selectedLogisticsUsers)) {
      for (const lId of selectedLogisticsUsers) {
        const assignment: ShipmentAssignment = {
          id: 'asg_' + Math.random().toString(36).substring(2, 9),
          shipmentId: newId,
          userId: lId,
          assignedAt: new Date().toISOString(),
        };
        await dbStore.saveAssignment(assignment);
      }
    }

    // ── Notify everyone newly attached to this shipment ────────────────────
    // Best-effort: failures here are logged inside notify.ts and never block
    // the response — the shipment is already saved by this point.
    const shipmentLink = `/shipments/${newId}`;

    if (newShipment.exporterId) {
      await notifyUser({
        userId:   newShipment.exporterId,
        type:     'SHIPMENT_ASSIGNED',
        title:    'Added as exporter on a new shipment',
        body:     `You've been named exporter on shipment ${referenceCode} (${description}). Funds will route to your Stellar wallet on release.`,
        linkHref: shipmentLink,
      });
    }

    if (Array.isArray(selectedLogisticsUsers) && selectedLogisticsUsers.length > 0) {
      await notifyUsers(selectedLogisticsUsers, {
        type:     'SHIPMENT_ASSIGNED',
        title:    'Assigned to a new shipment',
        body:     `You've been assigned to shipment ${referenceCode} (${description}). You can now log milestone events for it.`,
        linkHref: shipmentLink,
      });
    }

    // Save Priority Milestones
    const milestonesList: PriorityMilestone[] = [];
    const milestoneTypes = Array.isArray(requiredMilestones)
      ? requiredMilestones
      : ['CUSTOMS_CLEARANCE_APPROVED', 'DELIVERED_AND_SIGNED_OFF'];

    for (const mType of milestoneTypes) {
      milestonesList.push({
        id: 'pm_' + Math.random().toString(36).substring(2, 9),
        shipmentId: newId,
        type: mType as any,
        isCompleted: false,
      });
    }
    await dbStore.savePriorityMilestones(milestonesList);

    // Create BOC Document Vault Folder (password hashing handled in vault route)
    if (vaultFolderName && vaultPassword) {
      const vaultFolder: VaultFolder = {
        id: 'vf_' + Math.random().toString(36).substring(2, 9),
        shipmentId: newId,
        referenceCode,
        folderName: String(vaultFolderName).trim(),
        password: String(vaultPassword).trim(),
        createdByUserId: importerId,
        createdAt: new Date().toISOString(),
      };
      await dbStore.saveVaultFolder(vaultFolder);
    }

    // Save uploaded documents (sent as base64 data URLs from the client —
    // see fileToDataUrl() in shipments/new/page.tsx; no Supabase Storage
    // bucket exists yet, so this matches the chat-image convention already
    // used elsewhere in the app). Each becomes a real shipment_documents row
    // so it actually shows up in the shipment detail page and BOC Vault.
    if (Array.isArray(documents) && documents.length > 0) {
      for (const doc of documents) {
        if (!doc?.name || !doc?.dataUrl) continue;
        const shipmentDoc: ShipmentDocument = {
          id: 'doc_' + Math.random().toString(36).substring(2, 9),
          shipmentId: newId,
          fileName: String(doc.name),
          fileUrl: String(doc.dataUrl),
          uploadedById: importerId,
          version: 1,
          isLatest: true,
          createdAt: new Date().toISOString(),
        };
        await dbStore.saveDocument(shipmentDoc);
      }
    }

    return NextResponse.json({ success: true, data: newShipment });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
