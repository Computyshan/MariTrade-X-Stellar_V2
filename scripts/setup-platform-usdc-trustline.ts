/**
 * scripts/setup-platform-usdc-trustline.ts
 *
 * One-time helper: establishes the MariTrade PLATFORM account's trustline
 * to the testnet USDC classic asset (issuer GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5).
 *
 * Why this is needed:
 *   The escrow contract's cancel() (PRE_DEPARTURE branch) and resolve_dispute()
 *   both transfer a platform fee via the USDC SAC to PLATFORM_ADDRESS, a
 *   classic G... account. The SAC bridges to the classic ledger for G...
 *   destinations, and classic Stellar accounts must hold an explicit
 *   trustline before they can receive a non-native asset — otherwise the
 *   transfer traps with "trustline entry is missing for account", which
 *   escalates to a VM trap and aborts the whole contract invocation
 *   (this is what was causing escrow-cancel's "0 auth entries" / 500 error).
 *
 * Usage:
 *   npx tsx scripts/setup-platform-usdc-trustline.ts
 *
 * Reads PLATFORM_STELLAR_SECRET_KEY and NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS
 * from .env.local directly — no arguments needed.
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_SECRET  = process.env.PLATFORM_STELLAR_SECRET_KEY ?? '';
const PLATFORM_ADDRESS = process.env.NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS ?? '';
const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const HORIZON_URL = NETWORK === 'mainnet'
  ? 'https://horizon.stellar.org'
  : 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = NETWORK === 'mainnet'
  ? StellarSdk.Networks.PUBLIC
  : StellarSdk.Networks.TESTNET;

// Testnet USDC (Circle) issuer — same address documented in contracts/escrow/README.md.
const USDC_ISSUER_TESTNET = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

async function main() {
  if (!PLATFORM_SECRET.startsWith('S')) {
    console.error('❌ PLATFORM_STELLAR_SECRET_KEY is not set (or malformed) in .env.local');
    process.exit(1);
  }
  if (!PLATFORM_ADDRESS.startsWith('G')) {
    console.error('❌ NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS is not set (or malformed) in .env.local');
    process.exit(1);
  }
  if (NETWORK !== 'testnet') {
    console.error(`❌ This script currently only knows the Circle testnet USDC issuer. Network is set to "${NETWORK}" — update USDC_ISSUER for mainnet before running.`);
    process.exit(1);
  }

  const platformKeypair = StellarSdk.Keypair.fromSecret(PLATFORM_SECRET);
  if (platformKeypair.publicKey() !== PLATFORM_ADDRESS) {
    console.error('❌ PLATFORM_STELLAR_SECRET_KEY does not match NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS. Double-check .env.local.');
    process.exit(1);
  }

  const usdcAsset = new StellarSdk.Asset('USDC', USDC_ISSUER_TESTNET);
  const server    = new StellarSdk.Horizon.Server(HORIZON_URL);

  console.log('─────────────────────────────────────────');
  console.log('  Platform USDC Trustline Setup');
  console.log('─────────────────────────────────────────');
  console.log(`  Network        : ${NETWORK}`);
  console.log(`  Platform wallet: ${PLATFORM_ADDRESS}`);
  console.log(`  USDC issuer    : ${USDC_ISSUER_TESTNET}`);
  console.log('─────────────────────────────────────────');

  const platformAccount = await server.loadAccount(PLATFORM_ADDRESS);

  const exists = platformAccount.balances.some(
    (b: any) =>
      b.asset_type !== 'native' &&
      b.asset_code === 'USDC' &&
      b.asset_issuer === USDC_ISSUER_TESTNET,
  );
  if (exists) {
    console.log('\n✅ Trustline already exists. Nothing to do — the transfer failure has another cause.');
    return;
  }

  console.log('\n⏳ Building changeTrust transaction...');
  const tx = new StellarSdk.TransactionBuilder(platformAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: usdcAsset,
        limit: '1000000000',
      }),
    )
    .setTimeout(180)
    .build();

  tx.sign(platformKeypair);

  try {
    const result = await server.submitTransaction(tx);
    console.log('\n✅ Trustline established!');
    console.log(`   Tx hash : ${result.hash}`);
    console.log(`   Explorer: https://stellar.expert/explorer/${NETWORK}/tx/${result.hash}`);
    console.log('\n   Platform can now receive USDC fee transfers from cancel() and resolve_dispute().');
    console.log('   Retry the escrow cancellation now.');
  } catch (err: any) {
    const detail = err?.response?.data?.extras?.result_codes ?? err.message;
    console.error('\n❌ Transaction failed:', JSON.stringify(detail, null, 2));
    process.exit(1);
  }
}

main();
