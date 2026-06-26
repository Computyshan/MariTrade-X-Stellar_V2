import { NextRequest, NextResponse } from 'next/server';
import { autofillBOCForm } from '@/lib/gemini';
import { requireAuth } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  // CRITICAL FIX: authenticate every request
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { invoiceText } = await req.json();
    if (!invoiceText) {
      return NextResponse.json({ success: false, error: 'Invoice text is required' }, { status: 400 });
    }

    const docExtracted = await autofillBOCForm(invoiceText);

    // Surface API key error clearly to caller so the UI can show a proper message
    if ('error' in docExtracted) {
      return NextResponse.json({ success: false, error: docExtracted.error }, { status: 503 });
    }

    return NextResponse.json({ success: true, data: docExtracted });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
