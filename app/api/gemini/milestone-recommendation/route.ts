import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { recommendPriorityMilestones } from '@/lib/gemini';

/**
 * POST /api/gemini/milestone-recommendation
 *
 * Phase 2 (AI-Assisted Decision Support) — Trade Party "Milestone-requirement
 * recommender". Returns a suggestion only; the importer applies it explicitly
 * in the UI (see Step 3 of app/(dashboard)/shipments/new/page.tsx), so
 * nothing here writes to a shipment record.
 */
export async function POST(req: NextRequest) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { cargoDescription, hsCode, isDangerousGoods, shipmentScope, originCountry, destinationPort, totalValueUSD } = body;

    if (!cargoDescription || !shipmentScope || !originCountry || !destinationPort) {
      return NextResponse.json({ success: false, error: 'Missing required cargo/route fields' }, { status: 400 });
    }

    const result = await recommendPriorityMilestones({
      cargoDescription,
      hsCode,
      isDangerousGoods: Boolean(isDangerousGoods),
      shipmentScope,
      originCountry,
      destinationPort,
      totalValueUSD: totalValueUSD != null ? Number(totalValueUSD) : undefined,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
