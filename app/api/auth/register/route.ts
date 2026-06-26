import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { dbStore } from '@/lib/db';
import { User } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, fullName, fullAddress, contactNumber } = body;

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { success: false, error: 'Email, password, and full name are required' },
        { status: 400 }
      );
    }

    // 1. Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
    });

    if (authError) {
      return NextResponse.json({ success: false, error: authError.message }, { status: 400 });
    }

    const authUser = authData.user;
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Sign-up failed — no user returned' }, { status: 500 });
    }

    // 2. Insert matching row into our users table using the auth UUID as id
    const newUser: User = {
      id: authUser.id,
      email: email.toLowerCase(),
      fullName,
      fullAddress: fullAddress || '',
      contactNumber: contactNumber || '',
      userType: 'TRADE_PARTY',
      jobRole: 'IMPORTER',
      companyName: '',
      kycStatus: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const savedUser = await dbStore.saveUser(newUser);
    return NextResponse.json({ success: true, data: savedUser });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
