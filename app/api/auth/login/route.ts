import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

/**
 * CRITICAL FIX: Removed the second supabase.auth.signInWithPassword() call.
 *
 * The client already signs in via Supabase Auth directly in login/page.tsx.
 * This route now only loads the app-level user row from the DB, using the
 * already-established session to verify the caller's identity.
 *
 * Before: password was sent in the request body a second time → security risk.
 * After: session cookie is verified server-side via requireAuth(), then user row is returned.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify the caller has a valid Supabase session from the client-side sign-in
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    // Load the app-level user row using the verified auth user ID
    const dbUser = await dbStore.getUserById(user!.id);
    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: 'Account not set up — please register first.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: dbUser });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
