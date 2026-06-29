/**
 * scripts/setup-pphp-trustline.ts
 *
 * One-time helper: establishes a PPHP trustline FROM a user wallet
 * using their secret key directly (useful for your own test wallets).
 *
 * For real users in the app, the trustline is built by lib/stellar/trustline.ts
 * and signed via Freighter in the browser — no secret key ever leaves the wallet.
 *
 * Usage:
 *   npx tsx scripts/setup-pphp-trustline.ts SUSER_SECRET_KEY_HERE
 *
 * After running this, run mint-pphp.ts to send PPHP to that wallet.
 */

import * as StellarSdk from 'stellar-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const USER_SECRET = process.argv[2] ?? '';
const PLATFORM_ADDRESS = process.env.NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS ?? '';
const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const HORIZON_URL = NETWORK === 'mainnet'
  ? 'https://horizon.stellar.org'
  : 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = NETWORK === 'mainnet'
  ? StellarSdk.Networks.PUBLIC
  : StellarSdk.Networks.TESTNET;

async function main() {
  if (!USER_SECRET.startsWith('S')) {
    console.error('❌ Pass the user wallet secret key (S...) as the first argument:');
    console.error('   npx tsx scripts/setup-pphp-trustline.ts SUSER_SECRET...');
    process.exit(1);
  }
  if (!PLATFORM_ADDRESS) {
    console.error('❌ NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS is not set in .env.local');
    process.exit(1);
  }

  const userKeypair    = StellarSdk.Keypair.fromSecret(USER_SECRET);
  const userPublicKey  = userKeypair.publicKey();
  const pphpAsset      = new StellarSdk.Asset('PPHP', PLATFORM_ADDRESS);
  const server         = new StellarSdk.Horizon.Server(HORIZON_URL);

  console.log('─────────────────────────────────────────');
  console.log('  PPHP Trustline Setup');
  console.log('─────────────────────────────────────────');
  console.log(`  Network  : ${NETWORK}`);
  console.log(`  Wallet   : ${userPublicKey}`);
  console.log(`  PPHP issuer: ${PLATFORM_ADDRESS}`);
  console.log('─────────────────────────────────────────');

  // Check if trustline already exists
  const userAccount = await server.loadAccount(userPublicKey);
  const exists = userAccount.balances.some(
    (b: any) =>
      b.asset_type !== 'native' &&
      b.asset_code === 'PPHP' &&
      b.asset_issuer === PLATFORM_ADDRESS,
  );
  if (exists) {
    console.log('\n✅ Trustline already exists. Nothing to do.');
    return;
  }

  console.log('\n⏳ Building changeTrust transaction...');
  const tx = new StellarSdk.TransactionBuilder(userAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: pphpAsset,
        limit: '1000000000',
      }),
    )
    .setTimeout(180)
    .build();

  tx.sign(userKeypair);

  try {
    const result = await server.submitTransaction(tx);
    console.log('\n✅ Trustline established!');
    console.log(`   Tx hash : ${result.hash}`);
    console.log(`   Explorer: https://stellar.expert/explorer/${NETWORK}/tx/${result.hash}`);
    console.log('\n   Now run mint-pphp.ts to send PPHP to this wallet.');
  } catch (err: any) {
    const detail = err?.response?.data?.extras?.result_codes ?? err.message;
    console.error('\n❌ Transaction failed:', JSON.stringify(detail, null, 2));
    process.exit(1);
  }
}

main();
