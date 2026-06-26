/**
 * lib/auth-guard.ts
 *
 * Verifies the caller's Supabase session for protected API routes.
 *
 * The browser Supabase client stores sessions in localStorage, not HTTP cookies,
 * so we cannot rely on cookie-based session detection server-side. Instead,
 * the client must pass its access_token as "Authorization: Bearer <token>".
 *
 * The correct server-side verification pattern is:
 *   supabase.auth.getUser(token)   ← token passed directly
 * NOT:
 *   supabase.auth.getUser()        ← reads internal session storage (empty on server)
 *
 * Usage:
 *   const { user, errorResponse } = await requireAuth(req);
 *   if (errorResponse) return errorResponse;
 *   // user.id is now verified and safe to use
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export interface AuthResult {
  user: { id: string; email?: string } | null;
  errorResponse: NextResponse | null;
}

export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const unauthorized = () => ({
    user: null,
    errorResponse: NextResponse.json(
      { success: false, error: 'Unauthorized — please sign in.' },
      { status: 401 }
    ),
  });

  // Extract the JWT from the Authorization: Bearer header
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) return unauthorized();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  // Pass the JWT directly — this is the correct server-side verification method.
  // getUser() without an argument reads from the client's internal session cache
  // which is always empty in a stateless API route.
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) return unauthorized();

  return { user: data.user, errorResponse: null };
}
