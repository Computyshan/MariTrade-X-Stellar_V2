import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, jobRole, kycDocumentUrl, companyName, bankDetails, userType } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const user = await dbStore.getUserById(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const updatedUser = {
      ...user,
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
