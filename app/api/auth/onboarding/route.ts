import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  try {
    // Verify the caller has a valid Supabase session.
    // The userId comes from the verified token — never from the request body.
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { jobRole, kycDocumentUrl, companyName, bankDetails, userType } = body;

    const existingUser = await dbStore.getUserById(user!.id);
    if (!existingUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const updatedUser = {
      ...existingUser,
      ...(userType && { userType }),
      ...(jobRole && { jobRole }),
      ...(companyName && { companyName }),
      ...(bankDetails && { bankDetails }),
      ...(kycDocumentUrl && { kycDocumentUrl }),
      kycStatus: 'SUBMITTED' as const,
      updatedAt: new Date().toISOString(),
    };

    await dbStore.saveUser(updatedUser);
    return NextResponse.json({ success: true, data: updatedUser });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
