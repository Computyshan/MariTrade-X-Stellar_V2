import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { ShipmentStatus, EscrowStatus } from '@/types';

// ─── Analytics API ──────────────────────────────────────────────────────────
// Returns aggregated shipment + milestone data scoped to the requesting user.
// No new tables — all aggregation is done in-process over the same data the
// shipments list already fetches.

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const [allShipments, allAssignments, allMilestones] = await Promise.all([
      dbStore.getShipments(),
      dbStore.getAssignments(),
      dbStore.getAllMilestones(),
    ]);

    const userId = user!.id;
    const myAssignedIds = new Set(
      allAssignments.filter(a => a.userId === userId).map(a => a.shipmentId)
    );
    const shipments = allShipments.filter(
      s => s.importerId === userId || s.exporterId === userId || myAssignedIds.has(s.id)
    );
    const shipmentIds = new Set(shipments.map(s => s.id));
    const milestones = allMilestones.filter(m => shipmentIds.has(m.shipmentId));

    // ── Summary counts ─────────────────────────────────────────────────────
    const total      = shipments.length;
    const active     = shipments.filter(s => !['DELIVERED','CANCELLED'].includes(s.status)).length;
    const delivered  = shipments.filter(s => s.status === 'DELIVERED').length;
    const disputed   = shipments.filter(s => s.escrowStatus === 'DISPUTED').length;
    const cancelled  = shipments.filter(s => s.status === 'CANCELLED').length;

    const totalValueUSD = shipments.reduce((acc, s) => acc + (s.totalValueUSD ?? 0), 0);
    const escrowLockedUSD = shipments
      .filter(s => s.escrowStatus === 'FUNDED')
      .reduce((acc, s) => acc + (s.escrowAmountUSD ?? s.totalValueUSD ?? 0), 0);
    const escrowReleasedUSD = shipments
      .filter(s => s.escrowStatus === 'RELEASED')
      .reduce((acc, s) => acc + (s.totalValueUSD ?? 0), 0);

    // ── Status breakdown (for pie / donut chart) ───────────────────────────
    const statusCounts: Record<string, number> = {};
    for (const s of shipments) {
      statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
    }

    const escrowCounts: Record<string, number> = {};
    for (const s of shipments) {
      escrowCounts[s.escrowStatus] = (escrowCounts[s.escrowStatus] ?? 0) + 1;
    }

    // ── Scope breakdown ────────────────────────────────────────────────────
    const nationwide = shipments.filter(s => s.shipmentScope === 'NATIONWIDE').length;
    const overseas   = shipments.filter(s => s.shipmentScope === 'OVERSEAS').length;

    // ── Monthly shipment volumes (last 12 months) ──────────────────────────
    const now = new Date();
    const monthly: { month: string; created: number; delivered: number; valueUSD: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const inMonth = shipments.filter(s => {
        const c = new Date(s.createdAt);
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
      });
      monthly.push({
        month: label,
        created: inMonth.length,
        delivered: inMonth.filter(s => s.status === 'DELIVERED').length,
        valueUSD: inMonth.reduce((acc, s) => acc + (s.totalValueUSD ?? 0), 0),
      });
    }

    // ── Top routes (origin → destination, by count) ────────────────────────
    const routeMap = new Map<string, { count: number; valueUSD: number }>();
    for (const s of shipments) {
      const key = `${s.originCountry} → ${s.destinationPort}`;
      const existing = routeMap.get(key) ?? { count: 0, valueUSD: 0 };
      routeMap.set(key, {
        count: existing.count + 1,
        valueUSD: existing.valueUSD + (s.totalValueUSD ?? 0),
      });
    }
    const topRoutes = [...routeMap.entries()]
      .map(([route, data]) => ({ route, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ── Milestone activity (last 30 days, grouped by day) ─────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentMilestones = milestones.filter(m => new Date(m.occurredAt) >= thirtyDaysAgo);
    const milestoneByDay = new Map<string, number>();
    for (const m of recentMilestones) {
      const day = new Date(m.occurredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      milestoneByDay.set(day, (milestoneByDay.get(day) ?? 0) + 1);
    }
    const milestoneFeed = [...milestoneByDay.entries()]
      .map(([day, count]) => ({ day, count }))
      .slice(-14); // last 14 days with activity

    // ── Monthly summary (current month) ───────────────────────────────────
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthShipments = shipments.filter(s => new Date(s.createdAt) >= thisMonth);
    const monthlySummary = {
      month: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      created: thisMonthShipments.length,
      delivered: thisMonthShipments.filter(s => s.status === 'DELIVERED').length,
      valueUSD: thisMonthShipments.reduce((acc, s) => acc + (s.totalValueUSD ?? 0), 0),
      milestonesLogged: milestones.filter(m => new Date(m.occurredAt) >= thisMonth).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        summary: { total, active, delivered, disputed, cancelled, totalValueUSD, escrowLockedUSD, escrowReleasedUSD },
        statusCounts,
        escrowCounts,
        scopeCounts: { nationwide, overseas },
        monthly,
        topRoutes,
        milestoneFeed,
        monthlySummary,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
