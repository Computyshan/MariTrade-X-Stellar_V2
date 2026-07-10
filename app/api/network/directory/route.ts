import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { getUserJobRoles } from '@/types';
import { computeScorecardsForUsers } from '@/lib/reputation';

// CRITICAL FIX: authenticate every request
export async function GET(req: NextRequest) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const requesterId = searchParams.get('requesterId') || '';
    const search = (searchParams.get('search') || '').toLowerCase();

    const [users, allConnections, shipments, assignments, milestones] = await Promise.all([
      dbStore.getUsers(),
      requesterId ? dbStore.getConnectionRequestsForUser(requesterId) : Promise.resolve([]),
      dbStore.getShipments(),
      dbStore.getAssignments(),
      dbStore.getAllMilestones(),
    ]);

    const members = users.filter(
      u =>
        u.id !== requesterId &&
        (u.kycStatus === 'VERIFIED' || u.kycStatus === 'SUBMITTED') &&
        (search === '' ||
          u.fullName.toLowerCase().includes(search) ||
          (u.companyName || '').toLowerCase().includes(search) ||
          getUserJobRoles(u).some(r => r.toLowerCase().includes(search)))
    );

    // Batch-computed in one pass over shared tables — avoids N scorecard
    // queries for a directory page that can list dozens of members at once.
    const scorecards = computeScorecardsForUsers(members, { shipments, assignments, milestones });

    const decorated = members.map(m => {
      const conn = allConnections.find(
        c =>
          (c.requesterId === requesterId && c.receiverId === m.id) ||
          (c.receiverId === requesterId && c.requesterId === m.id)
      );
      return {
        ...m,
        connectionId: conn?.id ?? null,
        connectionStatus: conn?.status ?? null,
        isSender: conn ? conn.requesterId === requesterId : false,
        scorecard: scorecards.get(m.id) ?? null,
      };
    });

    return NextResponse.json({ success: true, data: decorated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
