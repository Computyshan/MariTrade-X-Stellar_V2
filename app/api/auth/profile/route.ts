import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, fullName, fullAddress, contactNumber, companyName, bankDetails, stellarWallet } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const user = dbStore.getUserById(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const updatedUser = {
      ...user,
      fullName: fullName || user.fullName,
      fullAddress: fullAddress !== undefined ? fullAddress : user.fullAddress,
      contactNumber: contactNumber !== undefined ? contactNumber : user.contactNumber,
      companyName: companyName !== undefined ? companyName : user.companyName,
      bankDetails: bankDetails !== undefined ? bankDetails : user.bankDetails,
      stellarWallet: stellarWallet !== undefined ? stellarWallet : user.stellarWallet,
      updatedAt: new Date().toISOString()
    };

    dbStore.saveUser(updatedUser);

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
