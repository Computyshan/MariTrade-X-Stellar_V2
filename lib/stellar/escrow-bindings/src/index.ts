import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCNF3MF3JJAX5ZZNLNJYFHVHJ3HVSNWX2M73IPWPGB7L3NGU6UF3AGL3",
  }
} as const

export enum RefundType {
  Full = 0,
  Partial = 1,
  Disputed = 2,
  None = 3,
}


/**
 * The full on-chain state of a single shipment's escrow vault.
 */
export interface EscrowRecord {
  /**
 * Amount held in escrow, in USDC strobes (1 USDC = 10_000_000 strobes).
 */
amount: i128;
  cancellation_stage: CancellationStage;
  /**
 * Milestones that have been confirmed by the logistics chain.
 */
confirmed_milestones: Array<MilestoneConfirmation>;
  created_at_ledger: u32;
  /**
 * Exporter (seller) — receives the USDC on successful release.
 */
exporter: string;
  funded_at_ledger: u32;
  /**
 * Importer (buyer) — funds the escrow.
 */
importer: string;
  /**
 * Partial refund percentage (0–100) applicable in PRE_DEPARTURE stage.
 * Set at contract creation time by the importer and locked.
 */
partial_refund_bps: u32;
  /**
 * MariTrade Stellar address — co-signer for arbitration.
 */
platform: string;
  /**
 * MariTrade reference code, e.g. "MT-2026-00042".
 * Stored as a Soroban String (max 28 chars to fit Stellar Memo).
 */
reference_code: string;
  /**
 * List of MilestoneTypes the importer requires before funds can be released.
 * Matches `PriorityMilestone[]` in the Prisma schema.
 */
required_milestones: Array<MilestoneType>;
  status: EscrowStatus;
  /**
 * USDC token contract address (SAC address on the target network).
 */
usdc_token: string;
}

/**
 * Current state of an escrow vault.
 * Mirrors `EscrowStatus` in the MariTrade TypeScript types.
 */
export enum EscrowStatus {
  Unfunded = 0,
  Funded = 1,
  Released = 2,
  Refunded = 3,
  Disputed = 4,
}

/**
 * All milestone types across all logistics roles.
 * Matches `MilestoneType` in `types/index.ts`.
 */
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

/**
 * Corresponds to `CancellationStage` in `/lib/escrow/cancellation.ts`.
 * Determines refund policy when an escrow is cancelled.
 */
export enum CancellationStage {
  Unfunded = 0,
  PreDeparture = 1,
  InTransit = 2,
  Delivered = 3,
}


/**
 * On-chain record of a confirmed milestone.
 */
export interface MilestoneConfirmation {
  /**
 * Ledger sequence number when the confirmation was recorded.
 */
confirmed_at_ledger: u32;
  /**
 * Stellar address of the logistics user who confirmed this milestone.
 */
confirmed_by: string;
  /**
 * IPFS CID or other URI pointing to the proof document / photo.
 * Required — matches the `evidenceUrl` rule from the product spec.
 */
evidence_uri: string;
  /**
 * The type of milestone that was confirmed.
 */
milestone_type: MilestoneType;
}

export const EscrowError = {
  /**
   * Contract has already been initialized (re-init attack prevention).
   */
  1: {message:"AlreadyInitialized"},
  /**
   * Constructor arguments are invalid (zero address, empty milestones, etc.).
   */
  2: {message:"InvalidInitParams"},
  /**
   * Caller is not the importer.
   */
  3: {message:"NotImporter"},
  /**
   * Caller is not the exporter.
   */
  4: {message:"NotExporter"},
  /**
   * Caller is not the MariTrade platform.
   */
  5: {message:"NotPlatform"},
  /**
   * Caller is not an authorized logistics user for this shipment.
   */
  6: {message:"NotAuthorizedLogisticsUser"},
  /**
   * Operation requires both importer and platform to sign.
   */
  7: {message:"RequiresBothPartiesSignature"},
  /**
   * Escrow has already been funded; cannot fund twice.
   */
  8: {message:"AlreadyFunded"},
  /**
   * Escrow must be in Funded state for this operation.
   */
  9: {message:"NotFunded"},
  /**
   * Amount deposited does not match the agreed escrow amount.
   */
  10: {message:"AmountMismatch"},
  /**
   * USDC transfer to the escrow account failed.
   */
  11: {message:"TransferFailed"},
  /**
   * Evidence URI is required when confirming a milestone.
   */
  12: {message:"MissingEvidence"},
  /**
   * This milestone type is not in the required milestones list.
   */
  13: {message:"MilestoneNotRequired"},
  /**
   * This milestone has already been confirmed.
   */
  14: {message:"MilestoneAlreadyConfirmed"},
  /**
   * Attempted to confirm a milestone on a non-active escrow.
   */
  15: {message:"EscrowNotActive"},
  /**
   * Not all required milestones are confirmed yet.
   */
  16: {message:"PriorityMilestonesIncomplete"},
  /**
   * Escrow has already been released or refunded.
   */
  17: {message:"AlreadySettled"},
  /**
   * Release requires importer authorization.
   */
  18: {message:"ReleaseNotAuthorized"},
  /**
   * Cancellation is not allowed at this stage (e.g., DELIVERED).
   */
  19: {message:"CancellationNotAllowed"},
  /**
   * In-transit cancellation requires platform arbitration signature.
   */
  20: {message:"RequiresPlatformArbitration"},
  /**
   * Pre-departure cancellation requires both importer + platform to sign.
   */
  21: {message:"RequiresBothPartiesForPreDeparture"},
  /**
   * Escrow is already in dispute state.
   */
  22: {message:"AlreadyDisputed"},
  /**
   * Only platform can resolve a dispute.
   */
  23: {message:"OnlyPlatformCanResolveDispute"},
  /**
   * Arithmetic overflow or underflow detected.
   */
  24: {message:"ArithmeticError"},
  /**
   * Storage entry not found (contract not initialized for this key).
   */
  25: {message:"NotFound"},
  /**
   * Partial refund basis points must be between 0 and 10_000.
   */
  26: {message:"InvalidBps"}
}

export type DataKey = {tag: "Platform", values: void} | {tag: "UsdcToken", values: void} | {tag: "Escrow", values: readonly [string]} | {tag: "LogisticsUsers", values: readonly [string]};

export interface Client {
  /**
   * Construct and simulate a fund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposit USDC into the escrow vault.
   * 
   * Pulls `amount` USDC from the importer's wallet into the contract account
   * using the SAC `transfer` operation. The importer must have approved the
   * allowance or be signing via Freighter / Wallet Kit.
   * 
   * Corresponds to the "Fund Escrow via Stellar" button in Step 4.
   * 
   * # Arguments
   * * `reference_code` — Shipment reference code
   * * `importer`       — Must match the importer on the escrow record
   * 
   * # Errors
   * * `AlreadyFunded`  — Escrow has already been funded
   * * `NotImporter`    — Caller is not the importer on this escrow
   */
  fund: ({reference_code, importer}: {reference_code: string, importer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a cancel transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cancel the escrow and refund the importer per the cancellation policy.
   * 
   * Implements the logic from `/lib/escrow/cancellation.ts`:
   * 
   * | Stage          | Allowed | Refund   | Who can cancel                      |
   * |----------------|---------|----------|-------------------------------------|
   * | UNFUNDED       | Yes     | Full     | Importer only                        |
   * | PRE_DEPARTURE  | Yes     | Partial  | Importer + Platform must both sign   |
   * | IN_TRANSIT     | Yes     | Disputed | Must use `raise_dispute` first       |
   * | DELIVERED      | No      | None     | Blocked                              |
   * 
   * # Arguments
   * * `reference_code` — Shipment reference code
   * * `importer`       — Must match the importer on the escrow
   * * `platform`       — Required for PRE_DEPARTURE; pass same address as platform
   * 
   * # Errors
   * * `CancellationNotAllowed`            — DELIVERED stage
   * * `RequiresPlatformArbitration`       — IN_TRANSIT; use raise_dispute instead
   * * `RequiresBothPartiesForPreDeparture`— PRE_DEPARTURE needs both auths
   */
  cancel: ({reference_code, importer, platform}: {reference_code: string, importer: string, platform: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a release transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Release USDC from the escrow vault to the exporter.
   * 
   * The "Release Funds" button in the shipment detail escrow panel calls this.
   * All priority milestones must be confirmed before this is permitted.
   * 
   * # Arguments
   * * `reference_code` — Shipment reference code
   * * `importer`       — Must be the importer on this escrow
   * 
   * # Errors
   * * `PriorityMilestonesIncomplete` — Not all required milestones confirmed
   * * `NotFunded`                    — Escrow is not in Funded state
   * * `AlreadySettled`               — Already released or refunded
   */
  release: ({reference_code, importer}: {reference_code: string, importer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return the full escrow record for a given shipment.
   */
  get_escrow: ({reference_code}: {reference_code: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<EscrowRecord>>>

  /**
   * Construct and simulate a get_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return the current escrow status for a shipment reference code.
   */
  get_status: ({reference_code}: {reference_code: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<EscrowStatus>>>

  /**
   * Construct and simulate a can_release transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return true if all priority milestones have been confirmed.
   * Used by the frontend to enable/disable the "Release Funds" button.
   */
  can_release: ({reference_code}: {reference_code: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<boolean>>>

  /**
   * Construct and simulate a advance_stage transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Platform-only: advance the cancellation stage as the shipment progresses.
   * 
   * Called by MariTrade backend when key milestones are logged:
   * - VESSEL_DEPARTED_ORIGIN   → IN_TRANSIT
   * - DELIVERED_AND_SIGNED_OFF → DELIVERED
   * 
   * This controls which cancellation policy applies per the product spec.
   */
  advance_stage: ({reference_code, platform, new_stage}: {reference_code: string, platform: string, new_stage: CancellationStage}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Register a new shipment escrow vault.
   * 
   * Called by the importer immediately after the exporter accepts the deal.
   * Corresponds to Step 4 "Fund Escrow" in the NewShipmentPage flow —
   * specifically the pre-funding record creation step.
   * 
   * # Arguments
   * * `reference_code`      — MariTrade ref code (e.g. "MT-2026-00042")
   * * `importer`            — Importer's Stellar address
   * * `exporter`            — Exporter's Stellar address
   * * `amount`              — USDC amount in strobes (totalValueUSD * 10_000_000)
   * * `required_milestones` — Priority milestones the importer selects in Step 3
   * * `partial_refund_bps`  — Refund % if cancelled pre-departure (0–10_000 bps)
   * 
   * # Errors
   * * `AlreadyInitialized`  — Escrow with this reference code already exists
   * * `InvalidInitParams`   — Empty milestones, zero amount, or invalid bps
   */
  create_escrow: ({reference_code, importer, exporter, amount, required_milestones, partial_refund_bps}: {reference_code: string, importer: string, exporter: string, amount: i128, required_milestones: Array<MilestoneType>, partial_refund_bps: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a raise_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Escalate an in-transit shipment to disputed status for platform arbitration.
   * 
   * Only callable by the importer when `cancellation_stage == IN_TRANSIT`.
   * After this, the platform calls `resolve_dispute` to split funds.
   */
  raise_dispute: ({reference_code, importer}: {reference_code: string, importer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a resolve_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Platform-only: resolve a disputed escrow by splitting funds.
   * 
   * `importer_bps + exporter_bps` must equal 10_000 (100%).
   * MariTrade platform can retain a portion if needed (via platform_bps).
   * 
   * # Arguments
   * * `reference_code` — Shipment reference code
   * * `platform`       — Must match the platform address
   * * `importer_bps`   — Basis points to refund to importer (0–10_000)
   * * `exporter_bps`   — Basis points to pay to exporter (0–10_000)
   * 
   * Note: Any remainder (10_000 - importer_bps - exporter_bps) is retained
   * by the platform as an arbitration fee.
   */
  resolve_dispute: ({reference_code, platform, importer_bps, exporter_bps}: {reference_code: string, platform: string, importer_bps: u32, exporter_bps: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a confirm_milestone transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Record a confirmed milestone event on-chain.
   * 
   * Only callable by an address in the logistics users list for this shipment.
   * Requires an evidence URI (IPFS CID or URL) — matches the product rule:
   * "Proof upload is REQUIRED for milestone submission."
   * 
   * # Arguments
   * * `reference_code`  — Shipment reference code
   * * `confirmer`       — Logistics user confirming this milestone
   * * `milestone_type`  — The MilestoneType being confirmed
   * * `evidence_uri`    — Proof document URI (IPFS hash or HTTPS URL)
   * 
   * # Errors
   * * `EscrowNotActive`             — Escrow is not in Funded state
   * * `NotAuthorizedLogisticsUser`  — Caller not in logistics user list
   * * `MilestoneNotRequired`        — Milestone not in importer's priority list
   * * `MilestoneAlreadyConfirmed`   — Milestone already recorded
   * * `MissingEvidence`             — Evidence URI is empty
   */
  confirm_milestone: ({reference_code, confirmer, milestone_type, evidence_uri}: {reference_code: string, confirmer: string, milestone_type: MilestoneType, evidence_uri: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a assign_logistics_users transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Assign logistics chain users who are permitted to confirm milestones.
   * 
   * Corresponds to Step 3 "Assign Logistics Users" in the shipment create flow.
   * Can be called multiple times to add new users (replaces the existing list).
   * 
   * # Arguments
   * * `reference_code` — Shipment reference code
   * * `importer`       — Must be the importer who created this escrow
   * * `users`          — Vec of logistics user Stellar addresses
   */
  assign_logistics_users: ({reference_code, importer, users}: {reference_code: string, importer: string, users: Array<string>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_pending_milestones transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return the list of required milestones that have NOT yet been confirmed.
   * Useful for the shipment detail page milestone gate panel.
   */
  get_pending_milestones: ({reference_code}: {reference_code: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<MilestoneType>>>>

  /**
   * Construct and simulate a get_confirmed_milestones transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return the list of confirmed milestone confirmations.
   */
  get_confirmed_milestones: ({reference_code}: {reference_code: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<MilestoneConfirmation>>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {platform, usdc_token}: {platform: string, usdc_token: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({platform, usdc_token}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAwAAAAAAAAAAAAAAClJlZnVuZFR5cGUAAAAAAAQAAAAAAAAABEZ1bGwAAAAAAAAAAAAAAAdQYXJ0aWFsAAAAAAEAAAAAAAAACERpc3B1dGVkAAAAAgAAAAAAAAAETm9uZQAAAAM=",
        "AAAAAQAAADxUaGUgZnVsbCBvbi1jaGFpbiBzdGF0ZSBvZiBhIHNpbmdsZSBzaGlwbWVudCdzIGVzY3JvdyB2YXVsdC4AAAAAAAAADEVzY3Jvd1JlY29yZAAAAA0AAABFQW1vdW50IGhlbGQgaW4gZXNjcm93LCBpbiBVU0RDIHN0cm9iZXMgKDEgVVNEQyA9IDEwXzAwMF8wMDAgc3Ryb2JlcykuAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAASY2FuY2VsbGF0aW9uX3N0YWdlAAAAAAfQAAAAEUNhbmNlbGxhdGlvblN0YWdlAAAAAAAAO01pbGVzdG9uZXMgdGhhdCBoYXZlIGJlZW4gY29uZmlybWVkIGJ5IHRoZSBsb2dpc3RpY3MgY2hhaW4uAAAAABRjb25maXJtZWRfbWlsZXN0b25lcwAAA+oAAAfQAAAAFU1pbGVzdG9uZUNvbmZpcm1hdGlvbgAAAAAAAAAAAAARY3JlYXRlZF9hdF9sZWRnZXIAAAAAAAAEAAAAPkV4cG9ydGVyIChzZWxsZXIpIOKAlCByZWNlaXZlcyB0aGUgVVNEQyBvbiBzdWNjZXNzZnVsIHJlbGVhc2UuAAAAAAAIZXhwb3J0ZXIAAAATAAAAAAAAABBmdW5kZWRfYXRfbGVkZ2VyAAAABAAAACZJbXBvcnRlciAoYnV5ZXIpIOKAlCBmdW5kcyB0aGUgZXNjcm93LgAAAAAACGltcG9ydGVyAAAAEwAAAIBQYXJ0aWFsIHJlZnVuZCBwZXJjZW50YWdlICgw4oCTMTAwKSBhcHBsaWNhYmxlIGluIFBSRV9ERVBBUlRVUkUgc3RhZ2UuClNldCBhdCBjb250cmFjdCBjcmVhdGlvbiB0aW1lIGJ5IHRoZSBpbXBvcnRlciBhbmQgbG9ja2VkLgAAABJwYXJ0aWFsX3JlZnVuZF9icHMAAAAAAAQAAAA4TWFyaVRyYWRlIFN0ZWxsYXIgYWRkcmVzcyDigJQgY28tc2lnbmVyIGZvciBhcmJpdHJhdGlvbi4AAAAIcGxhdGZvcm0AAAATAAAAbk1hcmlUcmFkZSByZWZlcmVuY2UgY29kZSwgZS5nLiAiTVQtMjAyNi0wMDA0MiIuClN0b3JlZCBhcyBhIFNvcm9iYW4gU3RyaW5nIChtYXggMjggY2hhcnMgdG8gZml0IFN0ZWxsYXIgTWVtbykuAAAAAAAOcmVmZXJlbmNlX2NvZGUAAAAAABAAAAB+TGlzdCBvZiBNaWxlc3RvbmVUeXBlcyB0aGUgaW1wb3J0ZXIgcmVxdWlyZXMgYmVmb3JlIGZ1bmRzIGNhbiBiZSByZWxlYXNlZC4KTWF0Y2hlcyBgUHJpb3JpdHlNaWxlc3RvbmVbXWAgaW4gdGhlIFByaXNtYSBzY2hlbWEuAAAAAAATcmVxdWlyZWRfbWlsZXN0b25lcwAAAAPqAAAH0AAAAA1NaWxlc3RvbmVUeXBlAAAAAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAMRXNjcm93U3RhdHVzAAAAQFVTREMgdG9rZW4gY29udHJhY3QgYWRkcmVzcyAoU0FDIGFkZHJlc3Mgb24gdGhlIHRhcmdldCBuZXR3b3JrKS4AAAAKdXNkY190b2tlbgAAAAAAEw==",
        "AAAAAwAAAFtDdXJyZW50IHN0YXRlIG9mIGFuIGVzY3JvdyB2YXVsdC4KTWlycm9ycyBgRXNjcm93U3RhdHVzYCBpbiB0aGUgTWFyaVRyYWRlIFR5cGVTY3JpcHQgdHlwZXMuAAAAAAAAAAAMRXNjcm93U3RhdHVzAAAABQAAABdObyBmdW5kcyBkZXBvc2l0ZWQgeWV0LgAAAAAIVW5mdW5kZWQAAAAAAAAAMEltcG9ydGVyIGhhcyBkZXBvc2l0ZWQgVVNEQy4gU2hpcG1lbnQgaXMgYWN0aXZlLgAAAAZGdW5kZWQAAAAAAAEAAABHQWxsIHByaW9yaXR5IG1pbGVzdG9uZXMgY29uZmlybWVkOyBpbXBvcnRlciByZWxlYXNlZCBmdW5kcyB0byBleHBvcnRlci4AAAAACFJlbGVhc2VkAAAAAgAAAEJDYW5jZWxsZWQgYmVmb3JlIGRlcGFydHVyZSDigJQgZnVsbCBvciBwYXJ0aWFsIHJlZnVuZCB0byBpbXBvcnRlci4AAAAAAAhSZWZ1bmRlZAAAAAMAAAA8SW4gYXJiaXRyYXRpb24uIE1hcmlUcmFkZSBwbGF0Zm9ybSBpcyByZXNvbHZpbmcgdGhlIGRpc3B1dGUuAAAACERpc3B1dGVkAAAABA==",
        "AAAAAwAAAFxBbGwgbWlsZXN0b25lIHR5cGVzIGFjcm9zcyBhbGwgbG9naXN0aWNzIHJvbGVzLgpNYXRjaGVzIGBNaWxlc3RvbmVUeXBlYCBpbiBgdHlwZXMvaW5kZXgudHNgLgAAAAAAAAANTWlsZXN0b25lVHlwZQAAAAAAABwAAAAAAAAAEEJvb2tpbmdDb25maXJtZWQAAAAAAAAAAAAAABtEb2N1bWVudHNTdWJtaXR0ZWRUb0NhcnJpZXIAAAAAAQAAAAAAAAAUU3BhY2VPblZlc3NlbFNlY3VyZWQAAAACAAAAAAAAABdDb250YWluZXJHYXRlZE91dE9yaWdpbgAAAAADAAAAAAAAABdDb250YWluZXJMb2FkZWRPblZlc3NlbAAAAAAEAAAAAAAAABVWZXNzZWxDbGVhcmVkVG9EZXBhcnQAAAAAAAAFAAAAAAAAABRWZXNzZWxEZXBhcnRlZE9yaWdpbgAAAAYAAAAAAAAAEkJpbGxPZkxhZGluZ0lzc3VlZAAAAAAABwAAAAAAAAAUVmVzc2VsQXJyaXZlZEF0QmVydGgAAAAIAAAAAAAAABhWZXNzZWxBcnJpdmVkRGVzdGluYXRpb24AAAAJAAAAAAAAABJDb250YWluZXJPZmZsb2FkZWQAAAAAAAoAAAAAAAAAG0NvbnRhaW5lckdhdGVkSW5EZXN0aW5hdGlvbgAAAAALAAAAAAAAABZDYXJnb1JlbGVhc2VkRm9yUGlja3VwAAAAAAAMAAAAAAAAABZJblRyYW5zaXRUb0Rlc3RpbmF0aW9uAAAAAAANAAAAAAAAABhBcnJpdmVkQXREZWxpdmVyeUFkZHJlc3MAAAAOAAAAAAAAABVEZWxpdmVyZWRBbmRTaWduZWRPZmYAAAAAAAAPAAAAAAAAAA1Cb2NFbnRyeUZpbGVkAAAAAAAAEAAAAAAAAAAWUG9ydEhvbGRQbGFjZWRPckxpZnRlZAAAAAAAEQAAAAAAAAASRHV0aWVzQW5kVGF4ZXNQYWlkAAAAAAASAAAAAAAAABtDdXN0b21zRXhhbWluYXRpb25SZXF1ZXN0ZWQAAAAAEwAAAAAAAAAYQ3VzdG9tc0NsZWFyYW5jZUFwcHJvdmVkAAAAFAAAAAAAAAAXQ2FyZ29SZWFkeUZvckNvbGxlY3Rpb24AAAAAFQAAAAAAAAAXQ2FyZ29JbnNwZWN0ZWRBbmRQYWNrZWQAAAAAFgAAAAAAAAAUQ2FyZ29TdGFnZWRGb3JQaWNrdXAAAAAXAAAAAAAAABdDYXJnb0hhbmRlZE9mZlRvQ2FycmllcgAAAAAYAAAAAAAAABVDYXJnb1BpY2tlZFVwRnJvbVBvcnQAAAAAAAAZAAAAAAAAABhDYXJnb1JlY2VpdmVkQXRXYXJlaG91c2UAAAAaAAAAAAAAABNJbmNvbWluZ0NhcmdvU3RvcmVkAAAAABs=",
        "AAAAAwAAAHpDb3JyZXNwb25kcyB0byBgQ2FuY2VsbGF0aW9uU3RhZ2VgIGluIGAvbGliL2VzY3Jvdy9jYW5jZWxsYXRpb24udHNgLgpEZXRlcm1pbmVzIHJlZnVuZCBwb2xpY3kgd2hlbiBhbiBlc2Nyb3cgaXMgY2FuY2VsbGVkLgAAAAAAAAAAABFDYW5jZWxsYXRpb25TdGFnZQAAAAAAAAQAAABBRXNjcm93IGNyZWF0ZWQgYnV0IG5vdCB5ZXQgZnVuZGVkIOKAlCBmdWxsIHJlZnVuZCwgaW1wb3J0ZXIgb25seS4AAAAAAAAIVW5mdW5kZWQAAAAAAAAAWkZ1bmRlZCBidXQgY2FyZ28gbm90IHlldCBkZXBhcnRlZCBvcmlnaW4gcG9ydCDigJQgcGFydGlhbCByZWZ1bmQsIGJvdGggcGFydGllcyArIHBsYXRmb3JtLgAAAAAADFByZURlcGFydHVyZQAAAAEAAABHVmVzc2VsIGhhcyBkZXBhcnRlZCDigJQgZGlzcHV0ZWQgcmVmdW5kLCBwbGF0Zm9ybSBhcmJpdHJhdGlvbiByZXF1aXJlZC4AAAAACUluVHJhbnNpdAAAAAAAAAIAAAA1RGVsaXZlcmVkIGFuZCBzaWduZWQgb2ZmIOKAlCBubyBjYW5jZWxsYXRpb24gYWxsb3dlZC4AAAAAAAAJRGVsaXZlcmVkAAAAAAAAAw==",
        "AAAAAQAAAClPbi1jaGFpbiByZWNvcmQgb2YgYSBjb25maXJtZWQgbWlsZXN0b25lLgAAAAAAAAAAAAAVTWlsZXN0b25lQ29uZmlybWF0aW9uAAAAAAAABAAAADpMZWRnZXIgc2VxdWVuY2UgbnVtYmVyIHdoZW4gdGhlIGNvbmZpcm1hdGlvbiB3YXMgcmVjb3JkZWQuAAAAAAATY29uZmlybWVkX2F0X2xlZGdlcgAAAAAEAAAAQ1N0ZWxsYXIgYWRkcmVzcyBvZiB0aGUgbG9naXN0aWNzIHVzZXIgd2hvIGNvbmZpcm1lZCB0aGlzIG1pbGVzdG9uZS4AAAAADGNvbmZpcm1lZF9ieQAAABMAAACASVBGUyBDSUQgb3Igb3RoZXIgVVJJIHBvaW50aW5nIHRvIHRoZSBwcm9vZiBkb2N1bWVudCAvIHBob3RvLgpSZXF1aXJlZCDigJQgbWF0Y2hlcyB0aGUgYGV2aWRlbmNlVXJsYCBydWxlIGZyb20gdGhlIHByb2R1Y3Qgc3BlYy4AAAAMZXZpZGVuY2VfdXJpAAAAEAAAAClUaGUgdHlwZSBvZiBtaWxlc3RvbmUgdGhhdCB3YXMgY29uZmlybWVkLgAAAAAAAA5taWxlc3RvbmVfdHlwZQAAAAAH0AAAAA1NaWxlc3RvbmVUeXBlAAAA",
        "AAAABAAAAAAAAAAAAAAAC0VzY3Jvd0Vycm9yAAAAABoAAABCQ29udHJhY3QgaGFzIGFscmVhZHkgYmVlbiBpbml0aWFsaXplZCAocmUtaW5pdCBhdHRhY2sgcHJldmVudGlvbikuAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAASUNvbnN0cnVjdG9yIGFyZ3VtZW50cyBhcmUgaW52YWxpZCAoemVybyBhZGRyZXNzLCBlbXB0eSBtaWxlc3RvbmVzLCBldGMuKS4AAAAAAAARSW52YWxpZEluaXRQYXJhbXMAAAAAAAACAAAAG0NhbGxlciBpcyBub3QgdGhlIGltcG9ydGVyLgAAAAALTm90SW1wb3J0ZXIAAAAAAwAAABtDYWxsZXIgaXMgbm90IHRoZSBleHBvcnRlci4AAAAAC05vdEV4cG9ydGVyAAAAAAQAAAAlQ2FsbGVyIGlzIG5vdCB0aGUgTWFyaVRyYWRlIHBsYXRmb3JtLgAAAAAAAAtOb3RQbGF0Zm9ybQAAAAAFAAAAPUNhbGxlciBpcyBub3QgYW4gYXV0aG9yaXplZCBsb2dpc3RpY3MgdXNlciBmb3IgdGhpcyBzaGlwbWVudC4AAAAAAAAaTm90QXV0aG9yaXplZExvZ2lzdGljc1VzZXIAAAAAAAYAAAA2T3BlcmF0aW9uIHJlcXVpcmVzIGJvdGggaW1wb3J0ZXIgYW5kIHBsYXRmb3JtIHRvIHNpZ24uAAAAAAAcUmVxdWlyZXNCb3RoUGFydGllc1NpZ25hdHVyZQAAAAcAAAAyRXNjcm93IGhhcyBhbHJlYWR5IGJlZW4gZnVuZGVkOyBjYW5ub3QgZnVuZCB0d2ljZS4AAAAAAA1BbHJlYWR5RnVuZGVkAAAAAAAACAAAADJFc2Nyb3cgbXVzdCBiZSBpbiBGdW5kZWQgc3RhdGUgZm9yIHRoaXMgb3BlcmF0aW9uLgAAAAAACU5vdEZ1bmRlZAAAAAAAAAkAAAA5QW1vdW50IGRlcG9zaXRlZCBkb2VzIG5vdCBtYXRjaCB0aGUgYWdyZWVkIGVzY3JvdyBhbW91bnQuAAAAAAAADkFtb3VudE1pc21hdGNoAAAAAAAKAAAAK1VTREMgdHJhbnNmZXIgdG8gdGhlIGVzY3JvdyBhY2NvdW50IGZhaWxlZC4AAAAADlRyYW5zZmVyRmFpbGVkAAAAAAALAAAANUV2aWRlbmNlIFVSSSBpcyByZXF1aXJlZCB3aGVuIGNvbmZpcm1pbmcgYSBtaWxlc3RvbmUuAAAAAAAAD01pc3NpbmdFdmlkZW5jZQAAAAAMAAAAO1RoaXMgbWlsZXN0b25lIHR5cGUgaXMgbm90IGluIHRoZSByZXF1aXJlZCBtaWxlc3RvbmVzIGxpc3QuAAAAABRNaWxlc3RvbmVOb3RSZXF1aXJlZAAAAA0AAAAqVGhpcyBtaWxlc3RvbmUgaGFzIGFscmVhZHkgYmVlbiBjb25maXJtZWQuAAAAAAAZTWlsZXN0b25lQWxyZWFkeUNvbmZpcm1lZAAAAAAAAA4AAAA4QXR0ZW1wdGVkIHRvIGNvbmZpcm0gYSBtaWxlc3RvbmUgb24gYSBub24tYWN0aXZlIGVzY3Jvdy4AAAAPRXNjcm93Tm90QWN0aXZlAAAAAA8AAAAuTm90IGFsbCByZXF1aXJlZCBtaWxlc3RvbmVzIGFyZSBjb25maXJtZWQgeWV0LgAAAAAAHFByaW9yaXR5TWlsZXN0b25lc0luY29tcGxldGUAAAAQAAAALUVzY3JvdyBoYXMgYWxyZWFkeSBiZWVuIHJlbGVhc2VkIG9yIHJlZnVuZGVkLgAAAAAAAA5BbHJlYWR5U2V0dGxlZAAAAAAAEQAAAChSZWxlYXNlIHJlcXVpcmVzIGltcG9ydGVyIGF1dGhvcml6YXRpb24uAAAAFFJlbGVhc2VOb3RBdXRob3JpemVkAAAAEgAAADxDYW5jZWxsYXRpb24gaXMgbm90IGFsbG93ZWQgYXQgdGhpcyBzdGFnZSAoZS5nLiwgREVMSVZFUkVEKS4AAAAWQ2FuY2VsbGF0aW9uTm90QWxsb3dlZAAAAAAAEwAAAEBJbi10cmFuc2l0IGNhbmNlbGxhdGlvbiByZXF1aXJlcyBwbGF0Zm9ybSBhcmJpdHJhdGlvbiBzaWduYXR1cmUuAAAAG1JlcXVpcmVzUGxhdGZvcm1BcmJpdHJhdGlvbgAAAAAUAAAARVByZS1kZXBhcnR1cmUgY2FuY2VsbGF0aW9uIHJlcXVpcmVzIGJvdGggaW1wb3J0ZXIgKyBwbGF0Zm9ybSB0byBzaWduLgAAAAAAACJSZXF1aXJlc0JvdGhQYXJ0aWVzRm9yUHJlRGVwYXJ0dXJlAAAAAAAVAAAAI0VzY3JvdyBpcyBhbHJlYWR5IGluIGRpc3B1dGUgc3RhdGUuAAAAAA9BbHJlYWR5RGlzcHV0ZWQAAAAAFgAAACRPbmx5IHBsYXRmb3JtIGNhbiByZXNvbHZlIGEgZGlzcHV0ZS4AAAAdT25seVBsYXRmb3JtQ2FuUmVzb2x2ZURpc3B1dGUAAAAAAAAXAAAAKkFyaXRobWV0aWMgb3ZlcmZsb3cgb3IgdW5kZXJmbG93IGRldGVjdGVkLgAAAAAAD0FyaXRobWV0aWNFcnJvcgAAAAAYAAAAQFN0b3JhZ2UgZW50cnkgbm90IGZvdW5kIChjb250cmFjdCBub3QgaW5pdGlhbGl6ZWQgZm9yIHRoaXMga2V5KS4AAAAITm90Rm91bmQAAAAZAAAAOVBhcnRpYWwgcmVmdW5kIGJhc2lzIHBvaW50cyBtdXN0IGJlIGJldHdlZW4gMCBhbmQgMTBfMDAwLgAAAAAAAApJbnZhbGlkQnBzAAAAAAAa",
        "AAAAAAAAAipEZXBvc2l0IFVTREMgaW50byB0aGUgZXNjcm93IHZhdWx0LgoKUHVsbHMgYGFtb3VudGAgVVNEQyBmcm9tIHRoZSBpbXBvcnRlcidzIHdhbGxldCBpbnRvIHRoZSBjb250cmFjdCBhY2NvdW50CnVzaW5nIHRoZSBTQUMgYHRyYW5zZmVyYCBvcGVyYXRpb24uIFRoZSBpbXBvcnRlciBtdXN0IGhhdmUgYXBwcm92ZWQgdGhlCmFsbG93YW5jZSBvciBiZSBzaWduaW5nIHZpYSBGcmVpZ2h0ZXIgLyBXYWxsZXQgS2l0LgoKQ29ycmVzcG9uZHMgdG8gdGhlICJGdW5kIEVzY3JvdyB2aWEgU3RlbGxhciIgYnV0dG9uIGluIFN0ZXAgNC4KCiMgQXJndW1lbnRzCiogYHJlZmVyZW5jZV9jb2RlYCDigJQgU2hpcG1lbnQgcmVmZXJlbmNlIGNvZGUKKiBgaW1wb3J0ZXJgICAgICAgIOKAlCBNdXN0IG1hdGNoIHRoZSBpbXBvcnRlciBvbiB0aGUgZXNjcm93IHJlY29yZAoKIyBFcnJvcnMKKiBgQWxyZWFkeUZ1bmRlZGAgIOKAlCBFc2Nyb3cgaGFzIGFscmVhZHkgYmVlbiBmdW5kZWQKKiBgTm90SW1wb3J0ZXJgICAgIOKAlCBDYWxsZXIgaXMgbm90IHRoZSBpbXBvcnRlciBvbiB0aGlzIGVzY3JvdwAAAAAABGZ1bmQAAAACAAAAAAAAAA5yZWZlcmVuY2VfY29kZQAAAAAAEAAAAAAAAAAIaW1wb3J0ZXIAAAATAAAAAQAAA+kAAAACAAAH0AAAAAtFc2Nyb3dFcnJvcgA=",
        "AAAAAAAABABDYW5jZWwgdGhlIGVzY3JvdyBhbmQgcmVmdW5kIHRoZSBpbXBvcnRlciBwZXIgdGhlIGNhbmNlbGxhdGlvbiBwb2xpY3kuCgpJbXBsZW1lbnRzIHRoZSBsb2dpYyBmcm9tIGAvbGliL2VzY3Jvdy9jYW5jZWxsYXRpb24udHNgOgoKfCBTdGFnZSAgICAgICAgICB8IEFsbG93ZWQgfCBSZWZ1bmQgICB8IFdobyBjYW4gY2FuY2VsICAgICAgICAgICAgICAgICAgICAgIHwKfC0tLS0tLS0tLS0tLS0tLS18LS0tLS0tLS0tfC0tLS0tLS0tLS18LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLXwKfCBVTkZVTkRFRCAgICAgICB8IFllcyAgICAgfCBGdWxsICAgICB8IEltcG9ydGVyIG9ubHkgICAgICAgICAgICAgICAgICAgICAgICB8CnwgUFJFX0RFUEFSVFVSRSAgfCBZZXMgICAgIHwgUGFydGlhbCAgfCBJbXBvcnRlciArIFBsYXRmb3JtIG11c3QgYm90aCBzaWduICAgfAp8IElOX1RSQU5TSVQgICAgIHwgWWVzICAgICB8IERpc3B1dGVkIHwgTXVzdCB1c2UgYHJhaXNlX2Rpc3B1dGVgIGZpcnN0ICAgICAgIHwKfCBERUxJVkVSRUQgICAgICB8IE5vICAgICAgfCBOb25lICAgICB8IEJsb2NrZWQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8CgojIEFyZ3VtZW50cwoqIGByZWZlcmVuY2VfY29kZWAg4oCUIFNoaXBtZW50IHJlZmVyZW5jZSBjb2RlCiogYGltcG9ydGVyYCAgICAgICDigJQgTXVzdCBtYXRjaCB0aGUgaW1wb3J0ZXIgb24gdGhlIGVzY3JvdwoqIGBwbGF0Zm9ybWAgICAgICAg4oCUIFJlcXVpcmVkIGZvciBQUkVfREVQQVJUVVJFOyBwYXNzIHNhbWUgYWRkcmVzcyBhcyBwbGF0Zm9ybQoKIyBFcnJvcnMKKiBgQ2FuY2VsbGF0aW9uTm90QWxsb3dlZGAgICAgICAgICAgICDigJQgREVMSVZFUkVEIHN0YWdlCiogYFJlcXVpcmVzUGxhdGZvcm1BcmJpdHJhdGlvbmAgICAgICAg4oCUIElOX1RSQU5TSVQ7IHVzZSByYWlzZV9kaXNwdXRlIGluc3RlYWQKKiBgUmVxdWlyZXNCb3RoUGFydGllc0ZvclByZURlcGFydHVyZWDigJQgUFJFX0RFUEFSVFVSRSBuZWVkcyBib3RoIGF1dGhzAAAABmNhbmNlbAAAAAAAAwAAAAAAAAAOcmVmZXJlbmNlX2NvZGUAAAAAABAAAAAAAAAACGltcG9ydGVyAAAAEwAAAAAAAAAIcGxhdGZvcm0AAAATAAAAAQAAA+kAAAACAAAH0AAAAAtFc2Nyb3dFcnJvcgA=",
        "AAAAAAAAAhRSZWxlYXNlIFVTREMgZnJvbSB0aGUgZXNjcm93IHZhdWx0IHRvIHRoZSBleHBvcnRlci4KClRoZSAiUmVsZWFzZSBGdW5kcyIgYnV0dG9uIGluIHRoZSBzaGlwbWVudCBkZXRhaWwgZXNjcm93IHBhbmVsIGNhbGxzIHRoaXMuCkFsbCBwcmlvcml0eSBtaWxlc3RvbmVzIG11c3QgYmUgY29uZmlybWVkIGJlZm9yZSB0aGlzIGlzIHBlcm1pdHRlZC4KCiMgQXJndW1lbnRzCiogYHJlZmVyZW5jZV9jb2RlYCDigJQgU2hpcG1lbnQgcmVmZXJlbmNlIGNvZGUKKiBgaW1wb3J0ZXJgICAgICAgIOKAlCBNdXN0IGJlIHRoZSBpbXBvcnRlciBvbiB0aGlzIGVzY3JvdwoKIyBFcnJvcnMKKiBgUHJpb3JpdHlNaWxlc3RvbmVzSW5jb21wbGV0ZWAg4oCUIE5vdCBhbGwgcmVxdWlyZWQgbWlsZXN0b25lcyBjb25maXJtZWQKKiBgTm90RnVuZGVkYCAgICAgICAgICAgICAgICAgICAg4oCUIEVzY3JvdyBpcyBub3QgaW4gRnVuZGVkIHN0YXRlCiogYEFscmVhZHlTZXR0bGVkYCAgICAgICAgICAgICAgIOKAlCBBbHJlYWR5IHJlbGVhc2VkIG9yIHJlZnVuZGVkAAAAB3JlbGVhc2UAAAAAAgAAAAAAAAAOcmVmZXJlbmNlX2NvZGUAAAAAABAAAAAAAAAACGltcG9ydGVyAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAALRXNjcm93RXJyb3IA",
        "AAAAAAAAADNSZXR1cm4gdGhlIGZ1bGwgZXNjcm93IHJlY29yZCBmb3IgYSBnaXZlbiBzaGlwbWVudC4AAAAACmdldF9lc2Nyb3cAAAAAAAEAAAAAAAAADnJlZmVyZW5jZV9jb2RlAAAAAAAQAAAAAQAAA+kAAAfQAAAADEVzY3Jvd1JlY29yZAAAB9AAAAALRXNjcm93RXJyb3IA",
        "AAAAAAAAAD9SZXR1cm4gdGhlIGN1cnJlbnQgZXNjcm93IHN0YXR1cyBmb3IgYSBzaGlwbWVudCByZWZlcmVuY2UgY29kZS4AAAAACmdldF9zdGF0dXMAAAAAAAEAAAAAAAAADnJlZmVyZW5jZV9jb2RlAAAAAAAQAAAAAQAAA+kAAAfQAAAADEVzY3Jvd1N0YXR1cwAAB9AAAAALRXNjcm93RXJyb3IA",
        "AAAAAAAAAH5SZXR1cm4gdHJ1ZSBpZiBhbGwgcHJpb3JpdHkgbWlsZXN0b25lcyBoYXZlIGJlZW4gY29uZmlybWVkLgpVc2VkIGJ5IHRoZSBmcm9udGVuZCB0byBlbmFibGUvZGlzYWJsZSB0aGUgIlJlbGVhc2UgRnVuZHMiIGJ1dHRvbi4AAAAAAAtjYW5fcmVsZWFzZQAAAAABAAAAAAAAAA5yZWZlcmVuY2VfY29kZQAAAAAAEAAAAAEAAAPpAAAAAQAAB9AAAAALRXNjcm93RXJyb3IA",
        "AAAAAAAAAUVJbml0aWFsaXplIHRoZSBjb250cmFjdCB3aXRoIHRoZSBNYXJpVHJhZGUgcGxhdGZvcm0gYWRkcmVzcyBhbmQgdGhlClVTREMgU0FDIChTdGVsbGFyIEFzc2V0IENvbnRyYWN0KSB0b2tlbiBhZGRyZXNzLgoKQ2FsbGVkIGF1dG9tYXRpY2FsbHkgYXQgZGVwbG95bWVudC4gQ2Fubm90IGJlIGNhbGxlZCBhZ2Fpbi4KCiMgQXJndW1lbnRzCiogYHBsYXRmb3JtYCAgIOKAlCBNYXJpVHJhZGUncyBTdGVsbGFyIGFjY291bnQgKEcuLi4gYWRkcmVzcykKKiBgdXNkY190b2tlbmAg4oCUIFVTREMgU0FDIGFkZHJlc3Mgb24gdGhlIHRhcmdldCBuZXR3b3JrIChDLi4uIGFkZHJlc3MpAAAAAAAADV9fY29uc3RydWN0b3IAAAAAAAACAAAAAAAAAAhwbGF0Zm9ybQAAABMAAAAAAAAACnVzZGNfdG9rZW4AAAAAABMAAAAA",
        "AAAAAAAAASBQbGF0Zm9ybS1vbmx5OiBhZHZhbmNlIHRoZSBjYW5jZWxsYXRpb24gc3RhZ2UgYXMgdGhlIHNoaXBtZW50IHByb2dyZXNzZXMuCgpDYWxsZWQgYnkgTWFyaVRyYWRlIGJhY2tlbmQgd2hlbiBrZXkgbWlsZXN0b25lcyBhcmUgbG9nZ2VkOgotIFZFU1NFTF9ERVBBUlRFRF9PUklHSU4gICDihpIgSU5fVFJBTlNJVAotIERFTElWRVJFRF9BTkRfU0lHTkVEX09GRiDihpIgREVMSVZFUkVECgpUaGlzIGNvbnRyb2xzIHdoaWNoIGNhbmNlbGxhdGlvbiBwb2xpY3kgYXBwbGllcyBwZXIgdGhlIHByb2R1Y3Qgc3BlYy4AAAANYWR2YW5jZV9zdGFnZQAAAAAAAAMAAAAAAAAADnJlZmVyZW5jZV9jb2RlAAAAAAAQAAAAAAAAAAhwbGF0Zm9ybQAAABMAAAAAAAAACW5ld19zdGFnZQAAAAAAB9AAAAARQ2FuY2VsbGF0aW9uU3RhZ2UAAAAAAAABAAAD6QAAAAIAAAfQAAAAC0VzY3Jvd0Vycm9yAA==",
        "AAAAAAAAAzVSZWdpc3RlciBhIG5ldyBzaGlwbWVudCBlc2Nyb3cgdmF1bHQuCgpDYWxsZWQgYnkgdGhlIGltcG9ydGVyIGltbWVkaWF0ZWx5IGFmdGVyIHRoZSBleHBvcnRlciBhY2NlcHRzIHRoZSBkZWFsLgpDb3JyZXNwb25kcyB0byBTdGVwIDQgIkZ1bmQgRXNjcm93IiBpbiB0aGUgTmV3U2hpcG1lbnRQYWdlIGZsb3cg4oCUCnNwZWNpZmljYWxseSB0aGUgcHJlLWZ1bmRpbmcgcmVjb3JkIGNyZWF0aW9uIHN0ZXAuCgojIEFyZ3VtZW50cwoqIGByZWZlcmVuY2VfY29kZWAgICAgICDigJQgTWFyaVRyYWRlIHJlZiBjb2RlIChlLmcuICJNVC0yMDI2LTAwMDQyIikKKiBgaW1wb3J0ZXJgICAgICAgICAgICAg4oCUIEltcG9ydGVyJ3MgU3RlbGxhciBhZGRyZXNzCiogYGV4cG9ydGVyYCAgICAgICAgICAgIOKAlCBFeHBvcnRlcidzIFN0ZWxsYXIgYWRkcmVzcwoqIGBhbW91bnRgICAgICAgICAgICAgICDigJQgVVNEQyBhbW91bnQgaW4gc3Ryb2JlcyAodG90YWxWYWx1ZVVTRCAqIDEwXzAwMF8wMDApCiogYHJlcXVpcmVkX21pbGVzdG9uZXNgIOKAlCBQcmlvcml0eSBtaWxlc3RvbmVzIHRoZSBpbXBvcnRlciBzZWxlY3RzIGluIFN0ZXAgMwoqIGBwYXJ0aWFsX3JlZnVuZF9icHNgICDigJQgUmVmdW5kICUgaWYgY2FuY2VsbGVkIHByZS1kZXBhcnR1cmUgKDDigJMxMF8wMDAgYnBzKQoKIyBFcnJvcnMKKiBgQWxyZWFkeUluaXRpYWxpemVkYCAg4oCUIEVzY3JvdyB3aXRoIHRoaXMgcmVmZXJlbmNlIGNvZGUgYWxyZWFkeSBleGlzdHMKKiBgSW52YWxpZEluaXRQYXJhbXNgICAg4oCUIEVtcHR5IG1pbGVzdG9uZXMsIHplcm8gYW1vdW50LCBvciBpbnZhbGlkIGJwcwAAAAAAAA1jcmVhdGVfZXNjcm93AAAAAAAABgAAAAAAAAAOcmVmZXJlbmNlX2NvZGUAAAAAABAAAAAAAAAACGltcG9ydGVyAAAAEwAAAAAAAAAIZXhwb3J0ZXIAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAE3JlcXVpcmVkX21pbGVzdG9uZXMAAAAD6gAAB9AAAAANTWlsZXN0b25lVHlwZQAAAAAAAAAAAAAScGFydGlhbF9yZWZ1bmRfYnBzAAAAAAAEAAAAAQAAA+kAAAACAAAH0AAAAAtFc2Nyb3dFcnJvcgA=",
        "AAAAAAAAANVFc2NhbGF0ZSBhbiBpbi10cmFuc2l0IHNoaXBtZW50IHRvIGRpc3B1dGVkIHN0YXR1cyBmb3IgcGxhdGZvcm0gYXJiaXRyYXRpb24uCgpPbmx5IGNhbGxhYmxlIGJ5IHRoZSBpbXBvcnRlciB3aGVuIGBjYW5jZWxsYXRpb25fc3RhZ2UgPT0gSU5fVFJBTlNJVGAuCkFmdGVyIHRoaXMsIHRoZSBwbGF0Zm9ybSBjYWxscyBgcmVzb2x2ZV9kaXNwdXRlYCB0byBzcGxpdCBmdW5kcy4AAAAAAAANcmFpc2VfZGlzcHV0ZQAAAAAAAAIAAAAAAAAADnJlZmVyZW5jZV9jb2RlAAAAAAAQAAAAAAAAAAhpbXBvcnRlcgAAABMAAAABAAAD6QAAAAIAAAfQAAAAC0VzY3Jvd0Vycm9yAA==",
        "AAAAAAAAAihQbGF0Zm9ybS1vbmx5OiByZXNvbHZlIGEgZGlzcHV0ZWQgZXNjcm93IGJ5IHNwbGl0dGluZyBmdW5kcy4KCmBpbXBvcnRlcl9icHMgKyBleHBvcnRlcl9icHNgIG11c3QgZXF1YWwgMTBfMDAwICgxMDAlKS4KTWFyaVRyYWRlIHBsYXRmb3JtIGNhbiByZXRhaW4gYSBwb3J0aW9uIGlmIG5lZWRlZCAodmlhIHBsYXRmb3JtX2JwcykuCgojIEFyZ3VtZW50cwoqIGByZWZlcmVuY2VfY29kZWAg4oCUIFNoaXBtZW50IHJlZmVyZW5jZSBjb2RlCiogYHBsYXRmb3JtYCAgICAgICDigJQgTXVzdCBtYXRjaCB0aGUgcGxhdGZvcm0gYWRkcmVzcwoqIGBpbXBvcnRlcl9icHNgICAg4oCUIEJhc2lzIHBvaW50cyB0byByZWZ1bmQgdG8gaW1wb3J0ZXIgKDDigJMxMF8wMDApCiogYGV4cG9ydGVyX2Jwc2AgICDigJQgQmFzaXMgcG9pbnRzIHRvIHBheSB0byBleHBvcnRlciAoMOKAkzEwXzAwMCkKCk5vdGU6IEFueSByZW1haW5kZXIgKDEwXzAwMCAtIGltcG9ydGVyX2JwcyAtIGV4cG9ydGVyX2JwcykgaXMgcmV0YWluZWQKYnkgdGhlIHBsYXRmb3JtIGFzIGFuIGFyYml0cmF0aW9uIGZlZS4AAAAPcmVzb2x2ZV9kaXNwdXRlAAAAAAQAAAAAAAAADnJlZmVyZW5jZV9jb2RlAAAAAAAQAAAAAAAAAAhwbGF0Zm9ybQAAABMAAAAAAAAADGltcG9ydGVyX2JwcwAAAAQAAAAAAAAADGV4cG9ydGVyX2JwcwAAAAQAAAABAAAD6QAAAAIAAAfQAAAAC0VzY3Jvd0Vycm9yAA==",
        "AAAAAAAAA0tSZWNvcmQgYSBjb25maXJtZWQgbWlsZXN0b25lIGV2ZW50IG9uLWNoYWluLgoKT25seSBjYWxsYWJsZSBieSBhbiBhZGRyZXNzIGluIHRoZSBsb2dpc3RpY3MgdXNlcnMgbGlzdCBmb3IgdGhpcyBzaGlwbWVudC4KUmVxdWlyZXMgYW4gZXZpZGVuY2UgVVJJIChJUEZTIENJRCBvciBVUkwpIOKAlCBtYXRjaGVzIHRoZSBwcm9kdWN0IHJ1bGU6CiJQcm9vZiB1cGxvYWQgaXMgUkVRVUlSRUQgZm9yIG1pbGVzdG9uZSBzdWJtaXNzaW9uLiIKCiMgQXJndW1lbnRzCiogYHJlZmVyZW5jZV9jb2RlYCAg4oCUIFNoaXBtZW50IHJlZmVyZW5jZSBjb2RlCiogYGNvbmZpcm1lcmAgICAgICAg4oCUIExvZ2lzdGljcyB1c2VyIGNvbmZpcm1pbmcgdGhpcyBtaWxlc3RvbmUKKiBgbWlsZXN0b25lX3R5cGVgICDigJQgVGhlIE1pbGVzdG9uZVR5cGUgYmVpbmcgY29uZmlybWVkCiogYGV2aWRlbmNlX3VyaWAgICAg4oCUIFByb29mIGRvY3VtZW50IFVSSSAoSVBGUyBoYXNoIG9yIEhUVFBTIFVSTCkKCiMgRXJyb3JzCiogYEVzY3Jvd05vdEFjdGl2ZWAgICAgICAgICAgICAg4oCUIEVzY3JvdyBpcyBub3QgaW4gRnVuZGVkIHN0YXRlCiogYE5vdEF1dGhvcml6ZWRMb2dpc3RpY3NVc2VyYCAg4oCUIENhbGxlciBub3QgaW4gbG9naXN0aWNzIHVzZXIgbGlzdAoqIGBNaWxlc3RvbmVOb3RSZXF1aXJlZGAgICAgICAgIOKAlCBNaWxlc3RvbmUgbm90IGluIGltcG9ydGVyJ3MgcHJpb3JpdHkgbGlzdAoqIGBNaWxlc3RvbmVBbHJlYWR5Q29uZmlybWVkYCAgIOKAlCBNaWxlc3RvbmUgYWxyZWFkeSByZWNvcmRlZAoqIGBNaXNzaW5nRXZpZGVuY2VgICAgICAgICAgICAgIOKAlCBFdmlkZW5jZSBVUkkgaXMgZW1wdHkAAAAAEWNvbmZpcm1fbWlsZXN0b25lAAAAAAAABAAAAAAAAAAOcmVmZXJlbmNlX2NvZGUAAAAAABAAAAAAAAAACWNvbmZpcm1lcgAAAAAAABMAAAAAAAAADm1pbGVzdG9uZV90eXBlAAAAAAfQAAAADU1pbGVzdG9uZVR5cGUAAAAAAAAAAAAADGV2aWRlbmNlX3VyaQAAABAAAAABAAAD6QAAAAIAAAfQAAAAC0VzY3Jvd0Vycm9yAA==",
        "AAAAAAAAAZ1Bc3NpZ24gbG9naXN0aWNzIGNoYWluIHVzZXJzIHdobyBhcmUgcGVybWl0dGVkIHRvIGNvbmZpcm0gbWlsZXN0b25lcy4KCkNvcnJlc3BvbmRzIHRvIFN0ZXAgMyAiQXNzaWduIExvZ2lzdGljcyBVc2VycyIgaW4gdGhlIHNoaXBtZW50IGNyZWF0ZSBmbG93LgpDYW4gYmUgY2FsbGVkIG11bHRpcGxlIHRpbWVzIHRvIGFkZCBuZXcgdXNlcnMgKHJlcGxhY2VzIHRoZSBleGlzdGluZyBsaXN0KS4KCiMgQXJndW1lbnRzCiogYHJlZmVyZW5jZV9jb2RlYCDigJQgU2hpcG1lbnQgcmVmZXJlbmNlIGNvZGUKKiBgaW1wb3J0ZXJgICAgICAgIOKAlCBNdXN0IGJlIHRoZSBpbXBvcnRlciB3aG8gY3JlYXRlZCB0aGlzIGVzY3JvdwoqIGB1c2Vyc2AgICAgICAgICAg4oCUIFZlYyBvZiBsb2dpc3RpY3MgdXNlciBTdGVsbGFyIGFkZHJlc3NlcwAAAAAAABZhc3NpZ25fbG9naXN0aWNzX3VzZXJzAAAAAAADAAAAAAAAAA5yZWZlcmVuY2VfY29kZQAAAAAAEAAAAAAAAAAIaW1wb3J0ZXIAAAATAAAAAAAAAAV1c2VycwAAAAAAA+oAAAATAAAAAQAAA+kAAAACAAAH0AAAAAtFc2Nyb3dFcnJvcgA=",
        "AAAAAAAAAIJSZXR1cm4gdGhlIGxpc3Qgb2YgcmVxdWlyZWQgbWlsZXN0b25lcyB0aGF0IGhhdmUgTk9UIHlldCBiZWVuIGNvbmZpcm1lZC4KVXNlZnVsIGZvciB0aGUgc2hpcG1lbnQgZGV0YWlsIHBhZ2UgbWlsZXN0b25lIGdhdGUgcGFuZWwuAAAAAAAWZ2V0X3BlbmRpbmdfbWlsZXN0b25lcwAAAAAAAQAAAAAAAAAOcmVmZXJlbmNlX2NvZGUAAAAAABAAAAABAAAD6QAAA+oAAAfQAAAADU1pbGVzdG9uZVR5cGUAAAAAAAfQAAAAC0VzY3Jvd0Vycm9yAA==",
        "AAAAAAAAADVSZXR1cm4gdGhlIGxpc3Qgb2YgY29uZmlybWVkIG1pbGVzdG9uZSBjb25maXJtYXRpb25zLgAAAAAAABhnZXRfY29uZmlybWVkX21pbGVzdG9uZXMAAAABAAAAAAAAAA5yZWZlcmVuY2VfY29kZQAAAAAAEAAAAAEAAAPpAAAD6gAAB9AAAAAVTWlsZXN0b25lQ29uZmlybWF0aW9uAAAAAAAH0AAAAAtFc2Nyb3dFcnJvcgA=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAAAAABESW5zdGFuY2Ugc3RvcmFnZTogTWFyaVRyYWRlIHBsYXRmb3JtIGFkZHJlc3MgKGdsb2JhbCwgc2luZ2xlIHZhbHVlKS4AAAAIUGxhdGZvcm0AAAAAAAAAPkluc3RhbmNlIHN0b3JhZ2U6IFVTREMgU0FDIHRva2VuIGFkZHJlc3MgKHNldCBhdCBkZXBsb3kgdGltZSkuAAAAAAAJVXNkY1Rva2VuAAAAAAAAAQAAAElQZXJzaXN0ZW50IHN0b3JhZ2U6IGZ1bGwgZXNjcm93IHJlY29yZCwga2V5ZWQgYnkgc2hpcG1lbnQgcmVmZXJlbmNlIGNvZGUuAAAAAAAABkVzY3JvdwAAAAAAAQAAABAAAAABAAAAb1BlcnNpc3RlbnQgc3RvcmFnZTogc2V0IG9mIFN0ZWxsYXIgYWRkcmVzc2VzIGF1dGhvcml6ZWQgYXMgbG9naXN0aWNzIHVzZXJzCmZvciBhIGdpdmVuIHNoaXBtZW50IHJlZmVyZW5jZSBjb2RlLgAAAAAOTG9naXN0aWNzVXNlcnMAAAAAAAEAAAAQ" ]),
      options
    )
  }
  public readonly fromJSON = {
    fund: this.txFromJSON<Result<void>>,
        cancel: this.txFromJSON<Result<void>>,
        release: this.txFromJSON<Result<void>>,
        get_escrow: this.txFromJSON<Result<EscrowRecord>>,
        get_status: this.txFromJSON<Result<EscrowStatus>>,
        can_release: this.txFromJSON<Result<boolean>>,
        advance_stage: this.txFromJSON<Result<void>>,
        create_escrow: this.txFromJSON<Result<void>>,
        raise_dispute: this.txFromJSON<Result<void>>,
        resolve_dispute: this.txFromJSON<Result<void>>,
        confirm_milestone: this.txFromJSON<Result<void>>,
        assign_logistics_users: this.txFromJSON<Result<void>>,
        get_pending_milestones: this.txFromJSON<Result<Array<MilestoneType>>>,
        get_confirmed_milestones: this.txFromJSON<Result<Array<MilestoneConfirmation>>>
  }
}