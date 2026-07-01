import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  // CRITICAL FIX: authenticate every request
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { userId, fullName, fullAddress, contactNumber, companyName, bankDetails, stellarWallet, trackingTier, brandingLogoUrl, brandingPrimaryColor, brandingCompanyLabel } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    // Only allow a user to update their own profile
    if (user!.id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden — you can only update your own profile.' }, { status: 403 });
    }

    const existingUser = await dbStore.getUserById(userId);
    if (!existingUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (trackingTier !== undefined && !['BRANDED', 'TIMELINE', 'WHITELABEL'].includes(trackingTier)) {
      return NextResponse.json({ success: false, error: 'Invalid trackingTier' }, { status: 400 });
    }

    const updatedUser = {
      ...existingUser,
      fullName: fullName || existingUser.fullName,
      fullAddress: fullAddress !== undefined ? fullAddress : existingUser.fullAddress,
      contactNumber: contactNumber !== undefined ? contactNumber : existingUser.contactNumber,
      companyName: companyName !== undefined ? companyName : existingUser.companyName,
      bankDetails: bankDetails !== undefined ? bankDetails : existingUser.bankDetails,
      stellarWallet: stellarWallet !== undefined ? stellarWallet : existingUser.stellarWallet,
      trackingTier: trackingTier !== undefined ? trackingTier : existingUser.trackingTier,
      brandingLogoUrl: brandingLogoUrl !== undefined ? brandingLogoUrl : existingUser.brandingLogoUrl,
      brandingPrimaryColor: brandingPrimaryColor !== undefined ? brandingPrimaryColor : existingUser.brandingPrimaryColor,
      brandingCompanyLabel: brandingCompanyLabel !== undefined ? brandingCompanyLabel : existingUser.brandingCompanyLabel,
      updatedAt: new Date().toISOString(),
    };

    await dbStore.saveUser(updatedUser);
    return NextResponse.json({ success: true, data: updatedUser });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
