import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { notifyUser, notifyUsers } from '@/lib/notify';
import { Shipment, PriorityMilestone, ShipmentAssignment, VaultFolder } from '@/types';

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
    // exporter, or an assigned logistics user. dbStore uses the Supabase
    // service-role client (bypasses RLS), so this filtering has to happen
    // here rather than relying on the "shipments_involved_users" RLS policy.
    const myUserId = user!.id;
    const myAssignedShipmentIds = new Set(
      assignments.filter(a => a.userId === myUserId).map(a => a.shipmentId)
    );
    const myShipments = list.filter(s =>
      s.importerId === myUserId ||
      s.exporterId === myUserId ||
      myAssignedShipmentIds.has(s.id)
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
  const { errorResponse } = await requireAuth(req);
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
      vaultFolderName,
      vaultPassword,
    } = body;

    if (!importerId || !description || !originCountry || !destinationPort || !shipmentScope || !totalValueUSD) {
      return NextResponse.json({ success: false, error: 'Missing required shipment details' }, { status: 400 });
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

    return NextResponse.json({ success: true, data: newShipment });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
