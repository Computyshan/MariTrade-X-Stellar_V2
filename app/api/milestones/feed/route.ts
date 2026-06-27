import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

/**
 * GET /api/milestones/feed
 *
 * Powers the dashboard's "Port Activity" (Trade Party) and "Recent Logs"
 * (Logistics Chain) panels. Returns the most recent MilestoneEvent rows,
 * scoped to shipments the requesting user is actually party to — same
 * scoping rule as GET /api/shipments: importer, exporter, or an assigned
 * logistics user on the shipment the milestone belongs to.
 *
 * dbStore uses the Supabase service-role client (bypasses RLS), so this
 * filtering has to happen here rather than relying on any RLS policy.
 */
export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const [allMilestones, shipments, assignments] = await Promise.all([
      dbStore.getAllMilestones(),
      dbStore.getShipments(),
      dbStore.getAssignments(),
    ]);

    const myUserId = user!.id;
    const myAssignedShipmentIds = new Set(
      assignments.filter(a => a.userId === myUserId).map(a => a.shipmentId)
    );
    const myShipmentIds = new Set(
      shipments
        .filter(s =>
          s.importerId === myUserId ||
          s.exporterId === myUserId ||
          myAssignedShipmentIds.has(s.id)
        )
        .map(s => s.id)
    );

    const myMilestones = allMilestones
      .filter(m => myShipmentIds.has(m.shipmentId))
      // dbStore.getAllMilestones() orders ascending by occurred_at — flip to
      // newest-first for an activity feed, then cap to a reasonable size.
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 30);

    return NextResponse.json({ success: true, data: myMilestones });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
