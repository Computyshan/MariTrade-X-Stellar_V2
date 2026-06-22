import { NextRequest, NextResponse } from 'next/server';
import { estimateFreightCost } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { originCountry, destinationPort, cargoWeightKg, cargoType } = await req.json();
    if (!originCountry || !destinationPort || !cargoWeightKg || !cargoType) {
      return NextResponse.json({ success: false, error: 'Missing calculation parameters' }, { status: 400 });
    }

    const estimate = await estimateFreightCost({
      originCountry,
      destinationPort,
      cargoWeightKg: parseFloat(cargoWeightKg),
      cargoType
    });

    return NextResponse.json({ success: true, data: estimate });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
