/**
 * lib/stellar/escrow-contract.ts
 *
 * MariTrade Escrow Contract — TypeScript integration layer.
 *
 * Built on top of the generated bindings in `./escrow-bindings`.
 * All XDR encoding / enum handling is done by the generated client —
 * no manual scvVec/scvSymbol needed.
 *
 * ── Phase 5 (Escrow-as-Incentive) ──────────────────────────────────────────
 * The on-chain contract in `contracts/escrow` now accepts three additional
 * `create_escrow` params (`milestone_bonuses`, `bond_logistics_user`,
 * `bond_amount`) and exposes two new entrypoints (`stake_performance_bond`,
 * `forfeit_bond`). After rebuilding the contract wasm, regenerate the
 * bindings so `MilestoneBonus` / `PerformanceBond` types + these methods show
 * up in `./escrow-bindings`:
 *
 *   cd contracts/escrow
 *   cargo build --release --target wasm32v1-none
 *   stellar contract bindings typescript \
 *     --wasm target/wasm32v1-none/release/maritrade_escrow.wasm \
 *     --output-dir ../../lib/stellar/escrow-bindings \
 *     --overwrite
 *
 * Until that's run locally, `MilestoneBonus` / `PerformanceBond` below are
 * hand-written mirrors of the Rust types so the rest of the app can build
 * against them — swap to the generated exports once bindings are refreshed.
 *
 * Usage:
 * ```ts
 * const client = getMariTradeEscrowClient("testnet", walletAddress);
 * const tx = await client.fund({ reference_code: "MT-2026-00001", importer: walletAddress });
 * const signed = await tx.signAndSend(); // via Freighter
 * ```
 */

import { Networks } from "@stellar/stellar-sdk";
import {
  Client,
  networks,
  MilestoneType,
  EscrowStatus,
  CancellationStage,
} from "./escrow-bindings/dist/index.js";

// Re-export everything consumers need so they don't import from bindings directly.
export type {
  EscrowRecord,
  MilestoneConfirmation,
} from "./escrow-bindings/dist/index.js";

export {
  MilestoneType,
  EscrowStatus,
  CancellationStage,
  EscrowError,
} from "./escrow-bindings/dist/index.js";

// ─── Phase 5 types (mirror contracts/escrow/src/types.rs) ──────────────────
// TODO: replace with the generated equivalents once bindings are regenerated
// (see module comment above).

/** Mirrors the on-chain `MilestoneBonus` struct. */
export interface MilestoneBonus {
  milestoneType: MilestoneType;
  /** USDC strobes (1 USDC = 10_000_000 strobes). */
  bonusAmount: bigint;
  /** Ledger window from `funded_at_ledger` within which confirmation must land. */
  slaLedgers: number;
  paid: boolean;
}

/** Mirrors the on-chain `PerformanceBond` struct. `bondAmount === 0n` means no bond required. */
export interface PerformanceBond {
  logisticsUser: string;
  /** USDC strobes. */
  bondAmount: bigint;
  staked: boolean;
  resolved: boolean;
}

// ─── Network presets ────────────────────────────────────────────────────────

export const NETWORKS = {
  testnet: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: Networks.TESTNET,
    contractId:
      process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID_TESTNET ??
      networks.testnet.contractId,
    usdcSacAddress: process.env.NEXT_PUBLIC_USDC_SAC_TESTNET ?? "",
  },
  mainnet: {
    rpcUrl: "https://soroban.stellar.org",
    networkPassphrase: Networks.PUBLIC,
    contractId: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID_MAINNET ?? "",
    usdcSacAddress: process.env.NEXT_PUBLIC_USDC_SAC_MAINNET ?? "",
  },
} as const;

export type NetworkName = keyof typeof NETWORKS;

// ─── Human-readable milestone labels (for UI) ───────────────────────────────

export const MILESTONE_LABELS: Record<MilestoneType, string> = {
  [MilestoneType.BookingConfirmed]: "Booking Confirmed",
  [MilestoneType.DocumentsSubmittedToCarrier]: "Documents Submitted to Carrier",
  [MilestoneType.SpaceOnVesselSecured]: "Space on Vessel Secured",
  [MilestoneType.ContainerGatedOutOrigin]: "Container Gated Out (Origin)",
  [MilestoneType.ContainerLoadedOnVessel]: "Container Loaded on Vessel",
  [MilestoneType.VesselClearedToDepart]: "Vessel Cleared to Depart",
  [MilestoneType.VesselDepartedOrigin]: "Vessel Departed Origin",
  [MilestoneType.BillOfLadingIssued]: "Bill of Lading Issued",
  [MilestoneType.VesselArrivedAtBerth]: "Vessel Arrived at Berth",
  [MilestoneType.VesselArrivedDestination]: "Vessel Arrived at Destination",
  [MilestoneType.ContainerOffloaded]: "Container Offloaded",
  [MilestoneType.ContainerGatedInDestination]: "Container Gated In (Destination)",
  [MilestoneType.CargoReleasedForPickup]: "Cargo Released for Pickup",
  [MilestoneType.InTransitToDestination]: "In Transit to Destination",
  [MilestoneType.ArrivedAtDeliveryAddress]: "Arrived at Delivery Address",
  [MilestoneType.DeliveredAndSignedOff]: "Delivered and Signed Off",
  [MilestoneType.BocEntryFiled]: "BOC Entry Filed",
  [MilestoneType.PortHoldPlacedOrLifted]: "Port Hold Placed / Lifted",
  [MilestoneType.DutiesAndTaxesPaid]: "Duties & Taxes Paid",
  [MilestoneType.CustomsExaminationRequested]: "Customs Examination Requested",
  [MilestoneType.CustomsClearanceApproved]: "Customs Clearance Approved",
  [MilestoneType.CargoReadyForCollection]: "Cargo Ready for Collection",
  [MilestoneType.CargoInspectedAndPacked]: "Cargo Inspected & Packed",
  [MilestoneType.CargoStagedForPickup]: "Cargo Staged for Pickup",
  [MilestoneType.CargoHandedOffToCarrier]: "Cargo Handed Off to Carrier",
  [MilestoneType.CargoPickedUpFromPort]: "Cargo Picked Up from Port",
  [MilestoneType.CargoReceivedAtWarehouse]: "Cargo Received at Warehouse",
  [MilestoneType.IncomingCargoStored]: "Incoming Cargo Stored",
};

// ─── Client factory ──────────────────────────────────────────────────────────

/** Singleton cache — one client per network + wallet address. */
const clientCache = new Map<string, Client>();

/**
 * Get a typed escrow contract client backed by the generated bindings.
 *
 * @param networkName     "testnet" or "mainnet"
 * @param sourcePublicKey  The connected wallet's G... address (used for simulation)
 */
export function getMariTradeEscrowClient(
  networkName: NetworkName,
  sourcePublicKey: string,
): Client {
  const cacheKey = `${networkName}:${sourcePublicKey}`;
  if (!clientCache.has(cacheKey)) {
    const net = NETWORKS[networkName];
    clientCache.set(
      cacheKey,
      new Client({
        contractId: net.contractId,
        networkPassphrase: net.networkPassphrase,
        rpcUrl: net.rpcUrl,
        publicKey: sourcePublicKey,
      }),
    );
  }
  return clientCache.get(cacheKey)!;
}

// ─── Utility helpers ─────────────────────────────────────────────────────────

/** Convert USDC strobes (bigint) to a display string: "10,000.00 USDC". */
export function formatUsdc(strobes: bigint): string {
  const usdc = Number(strobes) / 10_000_000;
  return (
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(usdc) + " USDC"
  );
}

/** Convert a whole-dollar USD amount to USDC strobes (bigint). */
export function usdToStrobes(usd: number): bigint {
  return BigInt(Math.round(usd * 10_000_000));
}
