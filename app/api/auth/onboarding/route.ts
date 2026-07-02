import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { JobRole, areJobRolesConsistent } from '@/types';

export async function POST(req: NextRequest) {
  try {
    // Verify the caller has a valid Supabase session.
    // The userId comes from the verified token — never from the request body.
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { jobRole, jobRoles, kycDocumentUrl, companyName, userType } = body;

    const existingUser = await dbStore.getUserById(user!.id);
    if (!existingUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Accept either a `jobRoles` array (preferred, multi-select) or a legacy
    // singular `jobRole`. Whichever comes in, we always write BOTH fields
    // together so `jobRoles` never goes stale relative to `jobRole` (this
    // used to leave a stale jobRoles array behind, silently breaking
    // milestone-logging permissions for the role the user actually picked).
    let nextRoles: JobRole[] | undefined;
    if (Array.isArray(jobRoles) && jobRoles.length > 0) {
      nextRoles = jobRoles as JobRole[];
    } else if (jobRole) {
      nextRoles = [jobRole as JobRole];
    }

    if (nextRoles && !areJobRolesConsistent(nextRoles)) {
      return NextResponse.json(
        { success: false, error: 'Job roles cannot mix Trade Party and Logistics Chain roles.' },
        { status: 400 }
      );
    }

    const updatedUser = {
      ...existingUser,
      ...(userType && { userType }),
      ...(nextRoles && { jobRole: nextRoles[0], jobRoles: nextRoles }),
      ...(companyName && { companyName }),
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
