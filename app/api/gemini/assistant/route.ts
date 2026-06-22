import { NextRequest, NextResponse } from 'next/server';
import { tagalogAssistant } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { message, context } = await req.json();
    if (!message) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    const answer = await tagalogAssistant(message, context);
    return NextResponse.json({ success: true, text: answer });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal AI Error' }, { status: 500 });
  }
}
