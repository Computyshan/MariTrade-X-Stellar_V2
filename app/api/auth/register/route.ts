import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { User, UserType, JobRole } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, fullName, fullAddress, contactNumber, userType, jobRole, companyName } = body;

    if (!email || !fullName) {
      return NextResponse.json({ success: false, error: 'Email and full name are required' }, { status: 400 });
    }

    const existingUsers = dbStore.getUsers();
    const userExists = existingUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (userExists) {
      return NextResponse.json({ success: false, error: 'User with this email already registered' }, { status: 400 });
    }

    const newUser: User = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      email: email.toLowerCase(),
      fullName,
      fullAddress: fullAddress || '',
      contactNumber: contactNumber || '',
      userType: (userType || 'TRADE_PARTY') as UserType,
      jobRole: (jobRole || 'IMPORTER') as JobRole,
      companyName: companyName || '',
      kycStatus: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const savedUser = dbStore.saveUser(newUser);

    return NextResponse.json({ success: true, data: savedUser });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
