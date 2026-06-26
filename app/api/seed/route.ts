/**
 * /api/seed — REMOVED
 *
 * This endpoint previously seeded hardcoded demo users into Supabase.
 * It has been disabled now that mock data has been cleared from the project.
 * All users must be created through the real registration flow.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Seed endpoint has been removed. Use the real registration flow.' },
    { status: 410 }
  );
}
