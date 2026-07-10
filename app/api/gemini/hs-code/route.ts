import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { classifyHsCode } from '@/lib/gemini';

/**
 * POST /api/gemini/hs-code
 *
 * Phase 2 (AI-Assisted Decision Support) — "HS code classification
 * assistant". Returns suggestions only; the filer (Trade Party at
 * shipment-creation time, or a Customs Broker reviewing it downstream)
 * must click to apply one — never auto-applied to the shipment record.
 */
export async function POST(req: NextRequest) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { cargoDescription, isDangerousGoods } = body;

    if (!cargoDescription || !cargoDescription.trim()) {
      return NextResponse.json({ success: false, error: 'cargoDescription is required' }, { status: 400 });
    }

    const result = await classifyHsCode({
      cargoDescription,
      isDangerousGoods: Boolean(isDangerousGoods),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
