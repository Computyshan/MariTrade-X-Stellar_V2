import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { ExternalCredential } from '@/types';

// Public profile fields — sensitive payment details are always stripped.
// bankDetails and stellarWallet are private to the account holder only.
type PublicProfile = {
  id: string;
  email: string;
  fullName: string;
  fullAddress?: string;
  contactNumber?: string;
  userType: string;
  jobRole: string;
  companyName?: string;
  kycStatus: string;
  createdAt: string;
  updatedAt: string;
  externalCredentials: ExternalCredential[];
  /** True once the user has at least one external credential on file. */
  preVerified: boolean;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require a valid session — profiles are not publicly readable
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const user = await dbStore.getUserById(id);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const externalCredentials = user.externalCredentials ?? [];

    // Strip sensitive financial fields before returning to any caller
    const publicProfile: PublicProfile = {
      id:            user.id,
      email:         user.email,
      fullName:      user.fullName,
      fullAddress:   user.fullAddress,
      contactNumber: user.contactNumber,
      userType:      user.userType,
      jobRole:       user.jobRole,
      companyName:   user.companyName,
      kycStatus:     user.kycStatus,
      createdAt:     user.createdAt,
      updatedAt:     user.updatedAt,
      externalCredentials,
      preVerified: externalCredentials.length > 0,
      // bankDetails  — intentionally omitted
      // stellarWallet — intentionally omitted
    };

    return NextResponse.json({ success: true, data: publicProfile });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
