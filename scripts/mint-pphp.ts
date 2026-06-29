/**
 * scripts/mint-pphp.ts
 *
 * One-time script: mint PPHP (Philippine Peso simulation) from the MariTrade
 * platform issuer account to a recipient wallet on Stellar testnet.
 *
 * The platform account IS the PPHP issuer. It can issue PPHP directly to any
 * account that has already established a trustline to it.
 *
 * Usage:
 *   npx tsx scripts/mint-pphp.ts GRECIPIENT... 500000
 *
 * Prerequisites:
 *   - PLATFORM_STELLAR_SECRET_KEY set in .env.local
 *   - Recipient wallet has already called changeTrust for PPHP (Step 4)
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// ─── Config ──────────────────────────────────────────────────────────────────

const RECIPIENT = process.argv[2] ?? 'PASTE_RECIPIENT_G_ADDRESS_HERE';
const AMOUNT    = process.argv[3] ?? '500000';  // ₱500,000 PPHP

const PLATFORM_SECRET  = process.env.PLATFORM_STELLAR_SECRET_KEY ?? '';
const NETWORK          = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const HORIZON_URL      = NETWORK === 'mainnet'
  ? 'https://horizon.stellar.org'
  : 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = NETWORK === 'mainnet'
  ? StellarSdk.Networks.PUBLIC
  : StellarSdk.Networks.TESTNET;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!PLATFORM_SECRET) {
    console.error('❌ PLATFORM_STELLAR_SECRET_KEY is not set in .env.local');
    process.exit(1);
  }
  if (RECIPIENT === 'PASTE_RECIPIENT_G_ADDRESS_HERE') {
    console.error('❌ Pass the recipient address as the first argument:');
    console.error('   npx tsx scripts/mint-pphp.ts GRECIPIENT... 500000');
    process.exit(1);
  }

  const issuerKeypair  = StellarSdk.Keypair.fromSecret(PLATFORM_SECRET);
  const issuerPublicKey = issuerKeypair.publicKey();
  const pphpAsset      = new StellarSdk.Asset('PPHP', issuerPublicKey);
  const server         = new StellarSdk.Horizon.Server(HORIZON_URL);

  console.log('─────────────────────────────────────────');
  console.log('  MariTrade PPHP Mint Script');
  console.log('─────────────────────────────────────────');
  console.log(`  Network  : ${NETWORK}`);
  console.log(`  Issuer   : ${issuerPublicKey}`);
  console.log(`  Recipient: ${RECIPIENT}`);
  console.log(`  Amount   : ₱${Number(AMOUNT).toLocaleString()} PPHP`);
  console.log('─────────────────────────────────────────');

  // Verify the recipient has a trustline before attempting payment
  console.log('\n⏳ Checking recipient trustline...');
  try {
    const recipientAccount = await server.loadAccount(RECIPIENT);
    const hasTrustline = recipientAccount.balances.some(
      (b: any) =>
        b.asset_type !== 'native' &&
        b.asset_code === 'PPHP' &&
        b.asset_issuer === issuerPublicKey,
    );
    if (!hasTrustline) {
      console.error(
        `\n❌ Recipient ${RECIPIENT} has no PPHP trustline.\n` +
        `   Complete Step 4 (establish trustline in Freighter) first, then re-run this script.`,
      );
      process.exit(1);
    }
    console.log('✅ Trustline confirmed.');
  } catch (err: any) {
    console.error(`\n❌ Could not load recipient account: ${err.message}`);
    process.exit(1);
  }

  // Build, sign, and submit payment from issuer → recipient
  console.log('\n⏳ Building and submitting payment...');
  const issuerAccount = await server.loadAccount(issuerPublicKey);

  const tx = new StellarSdk.TransactionBuilder(issuerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: RECIPIENT,
        asset: pphpAsset,
        amount: AMOUNT,
      }),
    )
    .addMemo(StellarSdk.Memo.text('MariTrade PPHP mint'))
    .setTimeout(180)
    .build();

  tx.sign(issuerKeypair);

  try {
    const result = await server.submitTransaction(tx);
    console.log('\n✅ PPHP minted successfully!');
    console.log(`   Tx hash : ${result.hash}`);
    console.log(`   Explorer: https://stellar.expert/explorer/${NETWORK}/tx/${result.hash}`);
    console.log(`\n   ${RECIPIENT} now holds ₱${Number(AMOUNT).toLocaleString()} PPHP.`);
  } catch (err: any) {
    const detail = err?.response?.data?.extras?.result_codes ?? err.message;
    console.error('\n❌ Transaction failed:', JSON.stringify(detail, null, 2));
    process.exit(1);
  }
}

main();
