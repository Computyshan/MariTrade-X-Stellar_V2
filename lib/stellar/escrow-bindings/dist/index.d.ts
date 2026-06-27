import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u32, i128 } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CCNF3MF3JJAX5ZZNLNJYFHVHJ3HVSNWX2M73IPWPGB7L3NGU6UF3AGL3";
    };
};
export declare enum RefundType {
    Full = 0,
    Partial = 1,
    Disputed = 2,
    None = 3
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
export declare enum EscrowStatus {
    Unfunded = 0,
    Funded = 1,
    Released = 2,
    Refunded = 3,
    Disputed = 4
}
/**
 * All milestone types across all logistics roles.
 * Matches `MilestoneType` in `types/index.ts`.
 */
export declare enum MilestoneType {
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
    IncomingCargoStored = 27
}
/**
 * Corresponds to `CancellationStage` in `/lib/escrow/cancellation.ts`.
 * Determines refund policy when an escrow is cancelled.
 */
export declare enum CancellationStage {
    Unfunded = 0,
    PreDeparture = 1,
    InTransit = 2,
    Delivered = 3
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
export declare const EscrowError: {
    /**
     * Contract has already been initialized (re-init attack prevention).
     */
    1: {
        message: string;
    };
    /**
     * Constructor arguments are invalid (zero address, empty milestones, etc.).
     */
    2: {
        message: string;
    };
    /**
     * Caller is not the importer.
     */
    3: {
        message: string;
    };
    /**
     * Caller is not the exporter.
     */
    4: {
        message: string;
    };
    /**
     * Caller is not the MariTrade platform.
     */
    5: {
        message: string;
    };
    /**
     * Caller is not an authorized logistics user for this shipment.
     */
    6: {
        message: string;
    };
    /**
     * Operation requires both importer and platform to sign.
     */
    7: {
        message: string;
    };
    /**
     * Escrow has already been funded; cannot fund twice.
     */
    8: {
        message: string;
    };
    /**
     * Escrow must be in Funded state for this operation.
     */
    9: {
        message: string;
    };
    /**
     * Amount deposited does not match the agreed escrow amount.
     */
    10: {
        message: string;
    };
    /**
     * USDC transfer to the escrow account failed.
     */
    11: {
        message: string;
    };
    /**
     * Evidence URI is required when confirming a milestone.
     */
    12: {
        message: string;
    };
    /**
     * This milestone type is not in the required milestones list.
     */
    13: {
        message: string;
    };
    /**
     * This milestone has already been confirmed.
     */
    14: {
        message: string;
    };
    /**
     * Attempted to confirm a milestone on a non-active escrow.
     */
    15: {
        message: string;
    };
    /**
     * Not all required milestones are confirmed yet.
     */
    16: {
        message: string;
    };
    /**
     * Escrow has already been released or refunded.
     */
    17: {
        message: string;
    };
    /**
     * Release requires importer authorization.
     */
    18: {
        message: string;
    };
    /**
     * Cancellation is not allowed at this stage (e.g., DELIVERED).
     */
    19: {
        message: string;
    };
    /**
     * In-transit cancellation requires platform arbitration signature.
     */
    20: {
        message: string;
    };
    /**
     * Pre-departure cancellation requires both importer + platform to sign.
     */
    21: {
        message: string;
    };
    /**
     * Escrow is already in dispute state.
     */
    22: {
        message: string;
    };
    /**
     * Only platform can resolve a dispute.
     */
    23: {
        message: string;
    };
    /**
     * Arithmetic overflow or underflow detected.
     */
    24: {
        message: string;
    };
    /**
     * Storage entry not found (contract not initialized for this key).
     */
    25: {
        message: string;
    };
    /**
     * Partial refund basis points must be between 0 and 10_000.
     */
    26: {
        message: string;
    };
};
export type DataKey = {
    tag: "Platform";
    values: void;
} | {
    tag: "UsdcToken";
    values: void;
} | {
    tag: "Escrow";
    values: readonly [string];
} | {
    tag: "LogisticsUsers";
    values: readonly [string];
};
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
    fund: ({ reference_code, importer }: {
        reference_code: string;
        importer: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
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
    cancel: ({ reference_code, importer, platform }: {
        reference_code: string;
        importer: string;
        platform: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
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
    release: ({ reference_code, importer }: {
        reference_code: string;
        importer: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a get_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Return the full escrow record for a given shipment.
     */
    get_escrow: ({ reference_code }: {
        reference_code: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<EscrowRecord>>>;
    /**
     * Construct and simulate a get_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Return the current escrow status for a shipment reference code.
     */
    get_status: ({ reference_code }: {
        reference_code: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<EscrowStatus>>>;
    /**
     * Construct and simulate a can_release transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Return true if all priority milestones have been confirmed.
     * Used by the frontend to enable/disable the "Release Funds" button.
     */
    can_release: ({ reference_code }: {
        reference_code: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<boolean>>>;
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
    advance_stage: ({ reference_code, platform, new_stage }: {
        reference_code: string;
        platform: string;
        new_stage: CancellationStage;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
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
    create_escrow: ({ reference_code, importer, exporter, amount, required_milestones, partial_refund_bps }: {
        reference_code: string;
        importer: string;
        exporter: string;
        amount: i128;
        required_milestones: Array<MilestoneType>;
        partial_refund_bps: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a raise_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Escalate an in-transit shipment to disputed status for platform arbitration.
     *
     * Only callable by the importer when `cancellation_stage == IN_TRANSIT`.
     * After this, the platform calls `resolve_dispute` to split funds.
     */
    raise_dispute: ({ reference_code, importer }: {
        reference_code: string;
        importer: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
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
    resolve_dispute: ({ reference_code, platform, importer_bps, exporter_bps }: {
        reference_code: string;
        platform: string;
        importer_bps: u32;
        exporter_bps: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
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
    confirm_milestone: ({ reference_code, confirmer, milestone_type, evidence_uri }: {
        reference_code: string;
        confirmer: string;
        milestone_type: MilestoneType;
        evidence_uri: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
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
    assign_logistics_users: ({ reference_code, importer, users }: {
        reference_code: string;
        importer: string;
        users: Array<string>;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a get_pending_milestones transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Return the list of required milestones that have NOT yet been confirmed.
     * Useful for the shipment detail page milestone gate panel.
     */
    get_pending_milestones: ({ reference_code }: {
        reference_code: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<MilestoneType>>>>;
    /**
     * Construct and simulate a get_confirmed_milestones transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Return the list of confirmed milestone confirmations.
     */
    get_confirmed_milestones: ({ reference_code }: {
        reference_code: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<MilestoneConfirmation>>>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { platform, usdc_token }: {
        platform: string;
        usdc_token: string;
    }, 
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        fund: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        cancel: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        release: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_escrow: (json: string) => AssembledTransaction<Result<EscrowRecord, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_status: (json: string) => AssembledTransaction<Result<EscrowStatus, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        can_release: (json: string) => AssembledTransaction<Result<boolean, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        advance_stage: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        create_escrow: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        raise_dispute: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        resolve_dispute: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        confirm_milestone: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        assign_logistics_users: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_pending_milestones: (json: string) => AssembledTransaction<Result<MilestoneType[], import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_confirmed_milestones: (json: string) => AssembledTransaction<Result<MilestoneConfirmation[], import("@stellar/stellar-sdk/contract").ErrorMessage>>;
    };
}
