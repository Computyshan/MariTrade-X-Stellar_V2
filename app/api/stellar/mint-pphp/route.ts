/**
 * app/api/stellar/mint-pphp/route.ts
 *
 * Server-side endpoint that simulates a PHP anchor crediting a user's
 * Stellar wallet with PPHP after a (simulated) bank deposit.
 *
 * In production this route would be replaced by a real anchor webhook
 * (SEP-24/SEP-6 deposit callback). For this demo it mints PPHP directly
 * from the MariTrade platform issuer account, mirroring scripts/mint-pphp.ts
 * but callable from inside the app instead of the CLI.
 *
 * POST body: { recipientAddress: string; amount: number }
 * Returns:   { success: true, data: { hash: string, explorerUrl: string } }
 */

import { NextRequest, NextResponse } from 'next/server';
import * as StellarSdk from '@stellar/stellar-sdk';
import { requireAuth } from '@/lib/auth-guard';
import { SUPPORTED_ASSETS, toStellarAsset } from '@/lib/stellar/assets';

const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const HORIZON_URL = NETWORK === 'mainnet'
  ? 'https://horizon.stellar.org'
  : 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = NETWORK === 'mainnet'
  ? StellarSdk.Networks.PUBLIC
  : StellarSdk.Networks.TESTNET;

export async function POST(req: NextRequest) {
  // Authenticate every request — only a logged-in MariTrade user can trigger a mint.
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const recipientAddress: string = body?.recipientAddress;
    const amount: number = Number(body?.amount);

    if (!recipientAddress || typeof recipientAddress !== 'string') {
      return NextResponse.json(
        { success: false, error: 'recipientAddress is required.' },
        { status: 400 },
      );
    }
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'amount must be a positive number.' },
        { status: 400 },
      );
    }

    const platformSecret = process.env.PLATFORM_STELLAR_SECRET_KEY ?? '';
    if (!platformSecret) {
      return NextResponse.json(
        {
          success: false,
          error: 'PLATFORM_STELLAR_SECRET_KEY is not configured on the server. ' +
                 'Set it in .env.local to enable PPHP minting.',
        },
        { status: 500 },
      );
    }

    const issuerKeypair = StellarSdk.Keypair.fromSecret(platformSecret);
    const pphpAsset = toStellarAsset(SUPPORTED_ASSETS.PPHP);
    const server = new StellarSdk.Horizon.Server(HORIZON_URL);

    // Verify the recipient has a PPHP trustline before attempting payment —
    // otherwise Stellar rejects the tx and the user sees a confusing error.
    let recipientAccount;
    try {
      recipientAccount = await server.loadAccount(recipientAddress);
    } catch {
      return NextResponse.json(
        { success: false, error: `Could not load Stellar account ${recipientAddress}. Make sure it is funded on ${NETWORK}.` },
        { status: 400 },
      );
    }

    const hasTrustline = recipientAccount.balances.some(
      (b: any) =>
        b.asset_type !== 'native' &&
        b.asset_code === SUPPORTED_ASSETS.PPHP.code &&
        b.asset_issuer === SUPPORTED_ASSETS.PPHP.issuer,
    );
    if (!hasTrustline) {
      return NextResponse.json(
        {
          success: false,
          error: 'Recipient has no PPHP trustline yet. Enable Philippine Peso payments first, then try again.',
          code: 'NO_TRUSTLINE',
        },
        { status: 400 },
      );
    }

    // Build, sign, and submit the issuer → recipient payment.
    const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());
    const tx = new StellarSdk.TransactionBuilder(issuerAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: recipientAddress,
          asset: pphpAsset,
          amount: amount.toFixed(2),
        }),
      )
      .addMemo(StellarSdk.Memo.text('MariTrade PPHP deposit'))
      .setTimeout(180)
      .build();

    tx.sign(issuerKeypair);

    const result = await server.submitTransaction(tx);

    return NextResponse.json({
      success: true,
      data: {
        hash: result.hash,
        explorerUrl: `https://stellar.expert/explorer/${NETWORK}/tx/${result.hash}`,
        amount,
        assetCode: SUPPORTED_ASSETS.PPHP.code,
      },
    });
  } catch (err: any) {
    const detail = err?.response?.data?.extras?.result_codes ?? err.message;
    return NextResponse.json(
      { success: false, error: typeof detail === 'string' ? detail : JSON.stringify(detail) },
      { status: 500 },
    );
  }
}
