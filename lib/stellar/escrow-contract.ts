/**
 * lib/stellar/escrow-contract.ts
 *
 * MariTrade Escrow Contract — TypeScript SDK integration layer.
 *
 * Wraps every Soroban contract function with typed arguments, XDR
 * encoding, simulation, and transaction assembly so Next.js pages
 * and API routes can call the escrow vault without touching raw XDR.
 *
 * Wallet signing (Freighter / Stellar Wallets Kit) is handled by the
 * caller — this module returns an `AssembledTransaction` that the
 * wallet can sign and submit.
 *
 * Usage (in a page component):
 * ```ts
 * const client = getMariTradeEscrowClient(networkPassphrase, rpcUrl, walletAddress);
 * const tx = await client.fund({ referenceCode: "MT-2026-00001", importer: walletAddress });
 * const result = await tx.signAndSend(); // via Freighter
 * ```
 */

import {
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
  Address,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import {
  Server,
  Api,
  assembleTransaction,
} from "@stellar/stellar-sdk/rpc";

// ─── Network presets ────────────────────────────────────────────────────────

export const NETWORKS = {
  testnet: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    passphrase: Networks.TESTNET,
    /** Replace with the deployed contract address after `stellar contract deploy` */
    contractId: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID_TESTNET ?? "",
    usdcSacAddress: process.env.NEXT_PUBLIC_USDC_SAC_TESTNET ?? "",
  },
  mainnet: {
    rpcUrl: "https://soroban.stellar.org",
    passphrase: Networks.PUBLIC,
    contractId: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID_MAINNET ?? "",
    usdcSacAddress: process.env.NEXT_PUBLIC_USDC_SAC_MAINNET ?? "",
  },
} as const;

export type NetworkName = keyof typeof NETWORKS;

// ─── Milestone types (mirrors Rust MilestoneType enum) ──────────────────────

export enum MilestoneType {
  BookingConfirmed = 0,
  DocumentsSubmittedToCarrier = 1,
  SpaceOnVesselSecured = 2,
  ContainerGatedOutOrigin = 3,
  ContainerLoadedOnVessel = 4,
  VesselClearedToDepart = 5,
  VesselDepartedOrigin = 6,
  BillOfLadingIssued = 7,
  VesselArrivedAtBerth = 8,
  VesselArrivedDestination = 9,
  ContainerOffloaded = 10,
  ContainerGatedInDestination = 11,
  CargoReleasedForPickup = 12,
  InTransitToDestination = 13,
  ArrivedAtDeliveryAddress = 14,
  DeliveredAndSignedOff = 15,
  BocEntryFiled = 16,
  PortHoldPlacedOrLifted = 17,
  DutiesAndTaxesPaid = 18,
  CustomsExaminationRequested = 19,
  CustomsClearanceApproved = 20,
  CargoReadyForCollection = 21,
  CargoInspectedAndPacked = 22,
  CargoStagedForPickup = 23,
  CargoHandedOffToCarrier = 24,
  CargoPickedUpFromPort = 25,
  CargoReceivedAtWarehouse = 26,
  IncomingCargoStored = 27,
}

/** Human-readable labels for the UI milestone selector. */
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

export enum EscrowStatus {
  Unfunded = 0,
  Funded = 1,
  Released = 2,
  Refunded = 3,
  Disputed = 4,
}

export enum CancellationStage {
  Unfunded = 0,
  PreDeparture = 1,
  InTransit = 2,
  Delivered = 3,
}

// ─── On-chain record shape (decoded from XDR) ────────────────────────────────

export interface MilestoneConfirmation {
  milestoneType: MilestoneType;
  confirmedBy: string;
  confirmedAtLedger: number;
  evidenceUri: string;
}

export interface EscrowRecord {
  platform: string;
  importer: string;
  exporter: string;
  referenceCode: string;
  usdcToken: string;
  /** Amount in USDC strobes (divide by 10_000_000 for display) */
  amount: bigint;
  partialRefundBps: number;
  requiredMilestones: MilestoneType[];
  confirmedMilestones: MilestoneConfirmation[];
  status: EscrowStatus;
  cancellationStage: CancellationStage;
  createdAtLedger: number;
  fundedAtLedger: number;
}

// ─── XDR helpers ─────────────────────────────────────────────────────────────

/** Convert a MilestoneType enum value to the Soroban ScVal enum format. */
function milestoneToScVal(m: MilestoneType): xdr.ScVal {
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol(MilestoneType[m]),
  ]);
}

/** Convert a JS string to a Soroban ScVal string. */
function stringToScVal(s: string): xdr.ScVal {
  return nativeToScVal(s, { type: "string" });
}

/** Convert a Stellar address string to Soroban ScVal address. */
function addressToScVal(addr: string): xdr.ScVal {
  return new Address(addr).toScVal();
}

/** Convert i128 amount to Soroban ScVal. */
function i128ToScVal(amount: bigint): xdr.ScVal {
  return nativeToScVal(amount, { type: "i128" });
}

/** Convert u32 to Soroban ScVal. */
function u32ToScVal(n: number): xdr.ScVal {
  return nativeToScVal(n, { type: "u32" });
}

// ─── Client ──────────────────────────────────────────────────────────────────

export interface EscrowClientConfig {
  networkName: NetworkName;
  /** Source account for fee-bump / simulation (usually the connected wallet). */
  sourcePublicKey: string;
}

export class MariTradeEscrowClient {
  private server: Server;
  private contract: Contract;
  private networkPassphrase: string;
  private sourcePublicKey: string;
  private contractId: string;

  constructor(config: EscrowClientConfig) {
    const network = NETWORKS[config.networkName];
    this.server = new Server(network.rpcUrl);
    this.contractId = network.contractId;
    this.contract = new Contract(network.contractId);
    this.networkPassphrase = network.passphrase;
    this.sourcePublicKey = config.sourcePublicKey;
  }

  // ── Internal: build + simulate a transaction ────────────────────────────

  private async buildAndSimulate(
    operation: xdr.Operation,
  ): Promise<{ built: string; result?: Api.SimulateTransactionSuccessResponse }> {
    const account = await this.server.getAccount(this.sourcePublicKey);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const simResult = await this.server.simulateTransaction(tx);

    if (Api.isSimulationError(simResult)) {
      throw new Error(`Simulation failed: ${simResult.error}`);
    }
    if (!Api.isSimulationSuccess(simResult)) {
      throw new Error("Transaction simulation returned unexpected result");
    }

    const assembled = assembleTransaction(tx, simResult);
    return { built: assembled.build().toEnvelope().toXDR().toString('base64'), result: simResult };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new escrow vault for a shipment.
   * Called in the NewShipmentPage Step 4 flow.
   *
   * @returns XDR-encoded transaction envelope ready for wallet signing.
   */
  async createEscrow(params: {
    referenceCode: string;
    importer: string;
    exporter: string;
    /** USDC amount in whole dollars — will be converted to strobes internally. */
    amountUsd: number;
    requiredMilestones: MilestoneType[];
    /** Partial refund percentage as a whole number (0–100). Converted to BPS. */
    partialRefundPercent: number;
  }): Promise<string> {
    const amountStrobes = BigInt(Math.round(params.amountUsd * 10_000_000));
    const partialRefundBps = params.partialRefundPercent * 100;

    const op = this.contract.call(
      "create_escrow",
      stringToScVal(params.referenceCode),
      addressToScVal(params.importer),
      addressToScVal(params.exporter),
      i128ToScVal(amountStrobes),
      xdr.ScVal.scvVec(params.requiredMilestones.map(milestoneToScVal)),
      u32ToScVal(partialRefundBps),
    );

    const { built } = await this.buildAndSimulate(op);
    return built;
  }

  /**
   * Assign logistics users who can confirm milestones for this shipment.
   * Called after Step 3 "Assign Logistics Team".
   */
  async assignLogisticsUsers(params: {
    referenceCode: string;
    importer: string;
    users: string[];
  }): Promise<string> {
    const op = this.contract.call(
      "assign_logistics_users",
      stringToScVal(params.referenceCode),
      addressToScVal(params.importer),
      xdr.ScVal.scvVec(params.users.map(addressToScVal)),
    );

    const { built } = await this.buildAndSimulate(op);
    return built;
  }

  /**
   * Deposit USDC into the escrow vault.
   * Triggers a SAC `transfer` from the importer to the contract.
   * The wallet must have signed a USDC allowance or be the direct signer.
   */
  async fund(params: {
    referenceCode: string;
    importer: string;
  }): Promise<string> {
    const op = this.contract.call(
      "fund",
      stringToScVal(params.referenceCode),
      addressToScVal(params.importer),
    );

    const { built } = await this.buildAndSimulate(op);
    return built;
  }

  /**
   * Confirm a milestone on-chain.
   * Called by logistics users from the shipment detail milestone panel.
   *
   * @param evidenceUri  IPFS CID (ipfs://...) or HTTPS URL of proof document.
   */
  async confirmMilestone(params: {
    referenceCode: string;
    confirmer: string;
    milestoneType: MilestoneType;
    evidenceUri: string;
  }): Promise<string> {
    const op = this.contract.call(
      "confirm_milestone",
      stringToScVal(params.referenceCode),
      addressToScVal(params.confirmer),
      milestoneToScVal(params.milestoneType),
      stringToScVal(params.evidenceUri),
    );

    const { built } = await this.buildAndSimulate(op);
    return built;
  }

  /**
   * Release USDC to the exporter once all priority milestones are confirmed.
   * Only callable by the importer.
   */
  async release(params: {
    referenceCode: string;
    importer: string;
  }): Promise<string> {
    const op = this.contract.call(
      "release",
      stringToScVal(params.referenceCode),
      addressToScVal(params.importer),
    );

    const { built } = await this.buildAndSimulate(op);
    return built;
  }

  /**
   * Cancel an escrow and refund the importer per the cancellation policy.
   * Requires both importer and platform to sign for PRE_DEPARTURE stage.
   */
  async cancel(params: {
    referenceCode: string;
    importer: string;
    platform: string;
  }): Promise<string> {
    const op = this.contract.call(
      "cancel",
      stringToScVal(params.referenceCode),
      addressToScVal(params.importer),
      addressToScVal(params.platform),
    );

    const { built } = await this.buildAndSimulate(op);
    return built;
  }

  /**
   * Raise a dispute for an in-transit shipment.
   * Flags the escrow as Disputed and queues it for platform arbitration.
   */
  async raiseDispute(params: {
    referenceCode: string;
    importer: string;
  }): Promise<string> {
    const op = this.contract.call(
      "raise_dispute",
      stringToScVal(params.referenceCode),
      addressToScVal(params.importer),
    );

    const { built } = await this.buildAndSimulate(op);
    return built;
  }

  /**
   * Platform-only: resolve a dispute by splitting funds between parties.
   * @param importerBps  Basis points (0–10_000) to refund to importer.
   * @param exporterBps  Basis points (0–10_000) to pay to exporter.
   * Remainder goes to platform as arbitration fee.
   */
  async resolveDispute(params: {
    referenceCode: string;
    platform: string;
    importerBps: number;
    exporterBps: number;
  }): Promise<string> {
    const op = this.contract.call(
      "resolve_dispute",
      stringToScVal(params.referenceCode),
      addressToScVal(params.platform),
      u32ToScVal(params.importerBps),
      u32ToScVal(params.exporterBps),
    );

    const { built } = await this.buildAndSimulate(op);
    return built;
  }

  /**
   * Platform-only: advance the cancellation stage.
   * Backend calls this when key milestones are logged in the DB.
   */
  async advanceStage(params: {
    referenceCode: string;
    platform: string;
    newStage: CancellationStage;
  }): Promise<string> {
    const stageNames = ["Unfunded", "PreDeparture", "InTransit", "Delivered"];
    const op = this.contract.call(
      "advance_stage",
      stringToScVal(params.referenceCode),
      addressToScVal(params.platform),
      xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(stageNames[params.newStage])]),
    );

    const { built } = await this.buildAndSimulate(op);
    return built;
  }

  // ── Read-only queries (no signing required) ─────────────────────────────

  /**
   * Fetch the full escrow record for a shipment.
   * Used to hydrate the EscrowPanel component on the shipment detail page.
   */
  async getEscrow(referenceCode: string): Promise<EscrowRecord | null> {
    try {
      const account = await this.server.getAccount(this.sourcePublicKey);

      const op = this.contract.call(
        "get_escrow",
        stringToScVal(referenceCode),
      );

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(op)
        .setTimeout(30)
        .build();

      const simResult = await this.server.simulateTransaction(tx);

      if (!Api.isSimulationSuccess(simResult) || !simResult.result) {
        return null;
      }

      return scValToNative(simResult.result.retval) as EscrowRecord;
    } catch {
      return null;
    }
  }

  /**
   * Check whether all priority milestones are confirmed.
   * Used to enable/disable the "Release Funds" button.
   */
  async canRelease(referenceCode: string): Promise<boolean> {
    try {
      const account = await this.server.getAccount(this.sourcePublicKey);

      const op = this.contract.call(
        "can_release",
        stringToScVal(referenceCode),
      );

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(op)
        .setTimeout(30)
        .build();

      const simResult = await this.server.simulateTransaction(tx);

      if (!Api.isSimulationSuccess(simResult) || !simResult.result) {
        return false;
      }

      return scValToNative(simResult.result.retval) as boolean;
    } catch {
      return false;
    }
  }

  /**
   * Get the list of milestones that have not yet been confirmed.
   * Used by the milestone gate panel.
   */
  async getPendingMilestones(referenceCode: string): Promise<MilestoneType[]> {
    try {
      const account = await this.server.getAccount(this.sourcePublicKey);

      const op = this.contract.call(
        "get_pending_milestones",
        stringToScVal(referenceCode),
      );

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(op)
        .setTimeout(30)
        .build();

      const simResult = await this.server.simulateTransaction(tx);

      if (!Api.isSimulationSuccess(simResult) || !simResult.result) {
        return [];
      }

      return scValToNative(simResult.result.retval) as MilestoneType[];
    } catch {
      return [];
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Singleton cache — one client per network per wallet address. */
const clientCache = new Map<string, MariTradeEscrowClient>();

export function getMariTradeEscrowClient(
  networkName: NetworkName,
  sourcePublicKey: string,
): MariTradeEscrowClient {
  const cacheKey = `${networkName}:${sourcePublicKey}`;
  if (!clientCache.has(cacheKey)) {
    clientCache.set(
      cacheKey,
      new MariTradeEscrowClient({ networkName, sourcePublicKey }),
    );
  }
  return clientCache.get(cacheKey)!;
}

// ─── Utility: format USDC for display ────────────────────────────────────────

/** Convert USDC strobes (i128) to a display string: "10,000.00 USDC". */
export function formatUsdc(strobes: bigint): string {
  const usdc = Number(strobes) / 10_000_000;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usdc) + " USDC";
}

/** Convert a whole-dollar amount to USDC strobes. */
export function usdToStrobes(usd: number): bigint {
  return BigInt(Math.round(usd * 10_000_000));
}
