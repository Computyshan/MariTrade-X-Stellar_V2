import { NextRequest, NextResponse } from 'next/server';
import { supabase, getSupabaseAdmin } from '@/lib/supabase';
import { User } from '@/types';

// Row → TypeScript mapper (mirrors lib/db.ts)
function rowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    fullAddress: row.full_address ?? undefined,
    contactNumber: row.contact_number ?? undefined,
    userType: row.user_type,
    jobRole: row.job_role,
    companyName: row.company_name ?? undefined,
    stellarWallet: row.stellar_wallet ?? undefined,
    bankDetails: row.bank_details ?? undefined,
    kycStatus: row.kyc_status,
    kycDocumentUrl: row.kyc_document_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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

    // 1. Create Supabase Auth user (anon client is fine here)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
    });

    if (authError) {
      // Surface a friendlier message for the rate-limit error
      const msg = authError.message.toLowerCase().includes('rate limit')
        ? 'Too many sign-up attempts. Please wait a few minutes and try again.'
        : authError.message;
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    // Supabase returns a user with identities=[] when the email already exists
    // but email confirmations are enabled — treat it as "already registered".
    if (authData.user && authData.user.identities?.length === 0) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists. Please sign in instead.' },
        { status: 409 }
      );
    }

    const authUser = authData.user;
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Sign-up failed — no user returned' }, { status: 500 });
    }

    // 2. Insert matching row into the users table.
    //    We use the service-role (admin) client so that RLS doesn’t block the
    //    insert — at sign-up time the new session isn’t yet established server-side.
    const adminClient = getSupabaseAdmin();

    const userRow = {
      id: authUser.id,
      email: email.toLowerCase(),
      full_name: fullName,
      full_address: fullAddress || null,
      contact_number: contactNumber || null,
      user_type: 'TRADE_PARTY',
      job_role: 'IMPORTER',
      company_name: null,
      kyc_status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: insertedRow, error: insertError } = await adminClient
      .from('users')
      .upsert(userRow, { onConflict: 'id' })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: rowToUser(insertedRow) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
