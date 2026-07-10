import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { computeScorecardForUser } from '@/lib/reputation';

/**
 * GET /api/network/scorecard?userId=...
 *
 * Phase 1 (Reputation & Marketplace Pressure) — returns the computed
 * performance scorecard (Logistics Chain) or reliability score (Trade
 * Party) for a single user. Any authenticated member can look up any
 * other member's scorecard — this is intentionally public-within-platform,
 * the same trust model as the KYC badge and the member directory.
 */
export async function GET(req: NextRequest) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || '';

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const user = await dbStore.getUserById(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const [shipments, assignments, milestones] = await Promise.all([
      dbStore.getShipments(),
      dbStore.getAssignments(),
      dbStore.getAllMilestones(),
    ]);

    const result = computeScorecardForUser(user, { shipments, assignments, milestones });

    if (!result) {
      return NextResponse.json({
        success: true,
        data: { kind: null, scorecard: null },
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
