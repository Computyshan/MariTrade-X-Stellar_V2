import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { ExternalCredential, ExternalCredentialType, JobRole, areJobRolesConsistent, jobRoleCategory } from '@/types';

const CREDENTIAL_TYPES: ExternalCredentialType[] = ['CERTIFICATE_URL', 'CERTIFICATE_IMAGE', 'RESUME_PDF'];
const MAX_CREDENTIALS = 12;

// Validates and normalizes the externalCredentials array coming from the
// client. Throws a plain Error with a user-facing message on any problem —
// the caller catches it and returns a 400.
function sanitizeCredentials(input: unknown): ExternalCredential[] {
  if (!Array.isArray(input)) throw new Error('externalCredentials must be an array.');
  if (input.length > MAX_CREDENTIALS) throw new Error(`You can list at most ${MAX_CREDENTIALS} credentials.`);

  return input.map((raw, i): ExternalCredential => {
    if (!raw || typeof raw !== 'object') throw new Error(`Credential #${i + 1} is invalid.`);
    const c = raw as Record<string, unknown>;

    const type = c.type as string;
    if (!CREDENTIAL_TYPES.includes(type as ExternalCredentialType)) {
      throw new Error(`Credential #${i + 1} has an invalid type.`);
    }

    const title = String(c.title ?? '').trim().slice(0, 120);
    if (!title) throw new Error(`Credential #${i + 1} needs a title.`);

    const url = String(c.url ?? '').trim().slice(0, 2000);
    if (!url) throw new Error(`Credential #${i + 1} needs a URL or uploaded file.`);
    if (type === 'CERTIFICATE_URL') {
      try { new URL(url); } catch { throw new Error(`Credential #${i + 1}'s link isn't a valid URL.`); }
    }

    const issuer = c.issuer !== undefined && c.issuer !== null ? String(c.issuer).trim().slice(0, 120) : undefined;
    const id = typeof c.id === 'string' && c.id ? c.id : `cred_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const addedAt = typeof c.addedAt === 'string' && c.addedAt ? c.addedAt : new Date().toISOString();

    return { id, type: type as ExternalCredentialType, title, issuer: issuer || undefined, url, addedAt };
  });
}

export async function POST(req: NextRequest) {
  // CRITICAL FIX: authenticate every request
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { userId, fullName, fullAddress, contactNumber, companyName, bankDetails, stellarWallet, trackingTier, brandingLogoUrl, brandingPrimaryColor, brandingCompanyLabel, externalCredentials, jobRoles } = body;

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

    let nextCredentials = existingUser.externalCredentials;
    if (externalCredentials !== undefined) {
      try {
        nextCredentials = sanitizeCredentials(externalCredentials);
      } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 400 });
      }
    }

    // ── Job roles (stacking/un-stacking responsibilities post-onboarding) ──
    // A user may add or drop roles here, but every role in the resulting set
    // must stay within their existing category (Trade Party vs Logistics
    // Chain) — switching category entirely still requires re-onboarding,
    // since it changes escrow authorization semantics, not just labels.
    let nextJobRoles = existingUser.jobRoles && existingUser.jobRoles.length > 0
      ? existingUser.jobRoles
      : [existingUser.jobRole];
    let nextJobRole = existingUser.jobRole;
    if (jobRoles !== undefined) {
      if (!Array.isArray(jobRoles) || jobRoles.length === 0) {
        return NextResponse.json({ success: false, error: 'jobRoles must be a non-empty array.' }, { status: 400 });
      }
      const roles = jobRoles as JobRole[];
      if (!areJobRolesConsistent(roles)) {
        return NextResponse.json({ success: false, error: 'Job roles cannot mix Trade Party and Logistics Chain roles.' }, { status: 400 });
      }
      if (jobRoleCategory(roles) !== existingUser.userType) {
        return NextResponse.json({
          success: false,
          error: `Your account is registered as ${existingUser.userType.replace('_', ' ')}. To switch categories entirely, contact support for re-onboarding.`,
        }, { status: 400 });
      }
      nextJobRoles = roles;
      nextJobRole = roles[0];
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
      externalCredentials: nextCredentials,
      jobRole: nextJobRole,
      jobRoles: nextJobRoles,
      updatedAt: new Date().toISOString(),
    };

    await dbStore.saveUser(updatedUser);
    return NextResponse.json({ success: true, data: updatedUser });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
