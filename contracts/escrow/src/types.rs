//! Domain types for the MariTrade escrow contract.
//!
//! These mirror the TypeScript types in `types/index.ts` and the Prisma schema
//! but live entirely on-chain.

#![no_std]

use soroban_sdk::{contracttype, Address, String, Vec};

// ─── Escrow Status ─────────────────────────────────────────────────────────────

/// Current state of an escrow vault.
/// Mirrors `EscrowStatus` in the MariTrade TypeScript types.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum EscrowStatus {
    /// No funds deposited yet.
    Unfunded = 0,
    /// Importer has deposited USDC. Shipment is active.
    Funded = 1,
    /// All priority milestones confirmed; importer released funds to exporter.
    Released = 2,
    /// Cancelled before departure — full or partial refund to importer.
    Refunded = 3,
    /// In arbitration. MariTrade platform is resolving the dispute.
    Disputed = 4,
}

// ─── Cancellation Stage ────────────────────────────────────────────────────────

/// Corresponds to `CancellationStage` in `/lib/escrow/cancellation.ts`.
/// Determines refund policy when an escrow is cancelled.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum CancellationStage {
    /// Escrow created but not yet funded — full refund, importer only.
    Unfunded = 0,
    /// Funded but cargo not yet departed origin port — partial refund, both parties + platform.
    PreDeparture = 1,
    /// Vessel has departed — disputed refund, platform arbitration required.
    InTransit = 2,
    /// Delivered and signed off — no cancellation allowed.
    Delivered = 3,
}

// ─── Refund Type ───────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RefundType {
    Full = 0,
    Partial = 1,
    Disputed = 2,
    None = 3,
}

// ─── Milestone Type ────────────────────────────────────────────────────────────

/// All milestone types across all logistics roles.
/// Matches `MilestoneType` in `types/index.ts`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum MilestoneType {
    // ── Freight Forwarder ──────────────────────────────────────
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
    // ── Customs Broker ────────────────────────────────────────
    BocEntryFiled = 16,
    PortHoldPlacedOrLifted = 17,
    DutiesAndTaxesPaid = 18,
    CustomsExaminationRequested = 19,
    CustomsClearanceApproved = 20,
    // ── Warehouse Operator ───────────────────────────────────
    CargoReadyForCollection = 21,
    CargoInspectedAndPacked = 22,
    CargoStagedForPickup = 23,
    CargoHandedOffToCarrier = 24,
    CargoPickedUpFromPort = 25,
    CargoReceivedAtWarehouse = 26,
    IncomingCargoStored = 27,
}

// ─── Milestone Confirmation ────────────────────────────────────────────────────

/// On-chain record of a confirmed milestone.
#[contracttype]
#[derive(Clone, Debug)]
pub struct MilestoneConfirmation {
    /// The type of milestone that was confirmed.
    pub milestone_type: MilestoneType,
    /// Stellar address of the logistics user who confirmed this milestone.
    pub confirmed_by: Address,
    /// Ledger sequence number when the confirmation was recorded.
    pub confirmed_at_ledger: u32,
    /// IPFS CID or other URI pointing to the proof document / photo.
    /// Required — matches the `evidenceUrl` rule from the product spec.
    pub evidence_uri: String,
}

// ─── Escrow Record ─────────────────────────────────────────────────────────────

/// The full on-chain state of a single shipment's escrow vault.
#[contracttype]
#[derive(Clone, Debug)]
pub struct EscrowRecord {
    // ── Parties ──────────────────────────────────────────────
    /// MariTrade Stellar address — co-signer for arbitration.
    pub platform: Address,
    /// Importer (buyer) — funds the escrow.
    pub importer: Address,
    /// Exporter (seller) — receives the USDC on successful release.
    pub exporter: Address,

    // ── Shipment identity ─────────────────────────────────────
    /// MariTrade reference code, e.g. "MT-2026-00042".
    /// Stored as a Soroban String (max 28 chars to fit Stellar Memo).
    pub reference_code: String,

    // ── Financial ─────────────────────────────────────────────
    /// USDC token contract address (SAC address on the target network).
    pub usdc_token: Address,
    /// Amount held in escrow, in USDC strobes (1 USDC = 10_000_000 strobes).
    pub amount: i128,
    /// Partial refund percentage (0–100) applicable in PRE_DEPARTURE stage.
    /// Set at contract creation time by the importer and locked.
    pub partial_refund_bps: u32,

    // ── Milestone gate ────────────────────────────────────────
    /// List of MilestoneTypes the importer requires before funds can be released.
    /// Matches `PriorityMilestone[]` in the Prisma schema.
    pub required_milestones: Vec<MilestoneType>,
    /// Milestones that have been confirmed by the logistics chain.
    pub confirmed_milestones: Vec<MilestoneConfirmation>,

    // ── Status ────────────────────────────────────────────────
    pub status: EscrowStatus,
    pub cancellation_stage: CancellationStage,

    // ── Timestamps (ledger sequences) ─────────────────────────
    pub created_at_ledger: u32,
    pub funded_at_ledger: u32,
}
