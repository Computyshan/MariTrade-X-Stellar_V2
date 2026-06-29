/**
 * /api/admin/disputes
 *
 * Returns all shipments currently in DISPUTED escrow status.
 * Used by the platform admin dispute resolution dashboard.
 *
 * GET  → { disputes: Shipment[] }  — all disputed shipments with party details
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { dbStore } from '@/lib/db';

const PLATFORM_ADDRESS = process.env.NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS ?? '';

export async function GET(req: NextRequest) {
  const { user: authedUser, errorResponse } = await requireAuth(req);
  if (errorResponse || !authedUser) {
    return errorResponse ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await dbStore.getUserById(authedUser.id);

  // Gate: only the platform wallet or any dev environment user
  const callerIsPlatform =
    dbUser?.stellarWallet === PLATFORM_ADDRESS ||
    process.env.NODE_ENV === 'development';

  if (!callerIsPlatform) {
    return NextResponse.json(
      { success: false, error: 'Only the MariTrade platform may access the dispute queue' },
      { status: 403 },
    );
  }

  try {
    const allShipments = await dbStore.getShipments();
    const disputed = allShipments.filter(s => s.escrowStatus === 'DISPUTED');

    // Attach importer + exporter user info for the admin UI
    const uniqueUserIds = Array.from(
      new Set(
        disputed.flatMap(s => [s.importerId, s.exporterId].filter(Boolean) as string[]),
      ),
    );
    const userMap: Record<string, { fullName: string; email: string; stellarWallet?: string }> = {};
    await Promise.all(
      uniqueUserIds.map(async uid => {
        const u = await dbStore.getUserById(uid);
        if (u) userMap[uid] = { fullName: u.fullName, email: u.email, stellarWallet: u.stellarWallet };
      }),
    );

    const enriched = disputed.map(s => ({
      ...s,
      importerUser: userMap[s.importerId] ?? null,
      exporterUser: s.exporterId ? (userMap[s.exporterId] ?? null) : null,
    }));

    return NextResponse.json({ success: true, data: { disputes: enriched } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
