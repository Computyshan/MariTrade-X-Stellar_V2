//! Contract error codes for the MariTrade escrow contract.

#![no_std]

use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum EscrowError {
    // ── Initialization ────────────────────────────────────────
    /// Contract has already been initialized (re-init attack prevention).
    AlreadyInitialized = 1,
    /// Constructor arguments are invalid (zero address, empty milestones, etc.).
    InvalidInitParams = 2,

    // ── Authorization ─────────────────────────────────────────
    /// Caller is not the importer.
    NotImporter = 3,
    /// Caller is not the exporter.
    NotExporter = 4,
    /// Caller is not the MariTrade platform.
    NotPlatform = 5,
    /// Caller is not an authorized logistics user for this shipment.
    NotAuthorizedLogisticsUser = 6,
    /// Operation requires both importer and platform to sign.
    RequiresBothPartiesSignature = 7,

    // ── Funding ───────────────────────────────────────────────
    /// Escrow has already been funded; cannot fund twice.
    AlreadyFunded = 8,
    /// Escrow must be in Funded state for this operation.
    NotFunded = 9,
    /// Amount deposited does not match the agreed escrow amount.
    AmountMismatch = 10,
    /// USDC transfer to the escrow account failed.
    TransferFailed = 11,

    // ── Milestones ────────────────────────────────────────────
    /// Evidence URI is required when confirming a milestone.
    MissingEvidence = 12,
    /// This milestone type is not in the required milestones list.
    MilestoneNotRequired = 13,
    /// This milestone has already been confirmed.
    MilestoneAlreadyConfirmed = 14,
    /// Attempted to confirm a milestone on a non-active escrow.
    EscrowNotActive = 15,

    // ── Release ───────────────────────────────────────────────
    /// Not all required milestones are confirmed yet.
    PriorityMilestonesIncomplete = 16,
    /// Escrow has already been released or refunded.
    AlreadySettled = 17,
    /// Release requires importer authorization.
    ReleaseNotAuthorized = 18,

    // ── Cancellation ─────────────────────────────────────────
    /// Cancellation is not allowed at this stage (e.g., DELIVERED).
    CancellationNotAllowed = 19,
    /// In-transit cancellation requires platform arbitration signature.
    RequiresPlatformArbitration = 20,
    /// Pre-departure cancellation requires both importer + platform to sign.
    RequiresBothPartiesForPreDeparture = 21,

    // ── Dispute ──────────────────────────────────────────────
    /// Escrow is already in dispute state.
    AlreadyDisputed = 22,
    /// Only platform can resolve a dispute.
    OnlyPlatformCanResolveDispute = 23,

    // ── General ──────────────────────────────────────────────
    /// Arithmetic overflow or underflow detected.
    ArithmeticError = 24,
    /// Storage entry not found (contract not initialized for this key).
    NotFound = 25,
    /// Partial refund basis points must be between 0 and 10_000.
    InvalidBps = 26,

    // ── Escrow-as-incentive (Phase 5) ───────────────────────
    /// A milestone bonus references a milestone that isn't in the escrow's
    /// required milestones, or has a non-positive amount / SLA window.
    InvalidBonusParams = 27,
    /// This shipment does not require a performance bond (bond_amount == 0).
    BondNotRequired = 28,
    /// The performance bond has already been staked.
    BondAlreadyStaked = 29,
    /// Caller is not the logistics user assigned to stake this bond.
    NotBondLogisticsUser = 30,
    /// The performance bond has not been staked yet (or is already resolved).
    BondNotStaked = 31,
}
