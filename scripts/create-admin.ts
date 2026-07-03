/**
 * scripts/create-admin.ts
 *
 * One-time / occasional script: provisions an ADMIN account directly,
 * completely bypassing the public register -> onboarding flow. This is the
 * ONLY supported way to create an admin account — there is no UI path to
 * ADMIN anywhere in the app (see types/index.ts and
 * app/api/auth/onboarding/route.ts for the enforcement).
 *
 * Requires the Supabase SERVICE ROLE key, so this must only ever be run
 * locally by a developer/ops person — never expose this script or the
 * service role key to the client/browser.
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts <email> <password> [fullName]
 *
 * Defaults to the credentials passed on the command line; if omitted, falls
 * back to the ADMIN_EMAIL / ADMIN_PASSWORD env vars. Nothing is hard-coded
 * in this file on purpose — don't commit real admin credentials to git.
 *
 * Prerequisites:
 *   - SUPABASE_SERVICE_ROLE_KEY set in .env.local
 *   - NEXT_PUBLIC_SUPABASE_URL set in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as readline from 'readline';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const EMAIL     = process.argv[2] ?? process.env.ADMIN_EMAIL ?? '';
const PASSWORD  = process.argv[3] ?? process.env.ADMIN_PASSWORD ?? '';
const FULL_NAME = process.argv[4] ?? 'MariTrade Admin';

const SUPABASE_URL       = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  if (!EMAIL || !PASSWORD) {
    console.error('Usage: npx tsx scripts/create-admin.ts <email> <password> [fullName]');
    process.exit(1);
  }
  if (PASSWORD.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const confirm = await prompt(
    `This will create an ADMIN account for "${EMAIL}". Continue? (yes/no): `
  );
  if (confirm.trim().toLowerCase() !== 'yes') {
    console.log('Aborted.');
    process.exit(0);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Create the Supabase Auth user directly (admin API) — no email
  //    confirmation step, no public /api/auth/register call involved.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: EMAIL.toLowerCase(),
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: 'ADMIN' },
  });

  if (authError || !authData.user) {
    console.error('Failed to create auth user:', authError?.message);
    process.exit(1);
  }

  const authUser = authData.user;

  // 2. Insert the matching profile row directly as ADMIN. This deliberately
  //    skips /api/auth/register and /api/auth/onboarding entirely, and sets
  //    kyc_status to VERIFIED since admins aren't subject to the trade-party
  //    KYC flow.
  const userRow = {
    id: authUser.id,
    email: EMAIL.toLowerCase(),
    full_name: FULL_NAME,
    user_type: 'ADMIN',
    job_role: 'ADMIN',
    job_roles: ['ADMIN'],
    kyc_status: 'VERIFIED',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: insertError } = await admin.from('users').upsert(userRow, { onConflict: 'id' });

  if (insertError) {
    console.error('Auth user was created, but the users-table insert failed:', insertError.message);
    console.error(`You can retry the insert manually for auth user id: ${authUser.id}`);
    process.exit(1);
  }

  console.log(`✅ Admin account created: ${EMAIL} (id: ${authUser.id})`);
  console.log('Reminder: rotate this password if it was ever typed into a chat, ticket, or shared doc.');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
