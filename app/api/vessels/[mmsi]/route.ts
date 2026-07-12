import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

// ─── GET /api/vessels/[mmsi] — cached last-known AIS position ──────────────
// Reads the ais_vessel_positions cache that scripts/ais-worker.ts keeps
// fresh from aisstream.io's WebSocket feed. Never calls aisstream.io
// directly (see lib/verification/ais-tracking.ts header comment for why).
//
// This is the endpoint lib/vessel-tracking.ts's checkVesselTrackingStatus()
// already calls, and that the new "Live Vessel Position" card on the
// shipment detail page polls. Both treat a 404 / non-2xx response as
// "nothing to show yet" rather than an error — an MMSI with no cached
// position is the expected state until the worker has actually seen it.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mmsi: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { mmsi } = await params;

    // Same validation as lib/vessel-tracking.ts's isValidMmsi — ordinary ship
    // stations only, 9 digits starting 2-7.
    if (!/^[2-7]\d{8}$/.test(mmsi)) {
      return NextResponse.json(
        { success: false, error: 'Invalid MMSI format — expected 9 digits starting 2-7.' },
        { status: 400 },
      );
    }

    const position = await dbStore.getLatestAisPosition(mmsi);

    if (!position) {
      return NextResponse.json(
        { success: false, error: `No cached AIS position for MMSI ${mmsi} yet.` },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: position });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
