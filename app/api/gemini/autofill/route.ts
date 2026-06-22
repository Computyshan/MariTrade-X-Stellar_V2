import { NextRequest, NextResponse } from 'next/server';
import { autofillBOCForm } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { invoiceText } = await req.json();
    if (!invoiceText) {
      return NextResponse.json({ success: false, error: 'Invoice text is required' }, { status: 400 });
    }

    const docExtracted = await autofillBOCForm(invoiceText);
    return NextResponse.json({ success: true, data: docExtracted });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
