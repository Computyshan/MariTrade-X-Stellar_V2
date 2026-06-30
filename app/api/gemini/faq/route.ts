import { NextRequest, NextResponse } from 'next/server';
import { landingFaqAssistant } from '@/lib/gemini';

// Very small in-memory rate limiter — fine for a single Next.js instance.
// Resets on redeploy/restart, which is acceptable for an FAQ widget.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX_REQUESTS;
}

export async function POST(req: NextRequest) {
  // Public endpoint — no auth, intended for the landing page only.
  // Deliberately does NOT accept or forward any account/shipment context.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ success: false, error: 'Too many messages — please wait a moment.' }, { status: 429 });
  }

  try {
    const { message } = await req.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }
    if (message.length > 500) {
      return NextResponse.json({ success: false, error: 'Message is too long' }, { status: 400 });
    }

    const answer = await landingFaqAssistant(message);
    return NextResponse.json({ success: true, text: answer });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal AI Error' }, { status: 500 });
  }
}
