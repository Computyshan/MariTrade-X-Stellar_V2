//! MariTrade Escrow — core contract implementation.
//!
//! ## Public API
//!
//! | Function                  | Caller              | Description                                         |
//! |---------------------------|---------------------|-----------------------------------------------------|
//! | `__constructor`           | deployer (once)     | Set platform + USDC token address                   |
//! | `create_escrow`           | importer            | Register a new shipment escrow vault                |
//! | `assign_logistics_users`  | importer            | Add logistics users who can confirm milestones      |
//! | `fund`                    | importer            | Deposit USDC into the vault                         |
//! | `confirm_milestone`       | logistics user      | Record a confirmed milestone with evidence URI      |
//! | `release`                 | importer            | Release USDC to exporter after all milestones done  |
//! | `cancel`                  | importer / platform | Cancel escrow and refund per cancellation policy    |
//! | `raise_dispute`           | importer            | Escalate IN_TRANSIT cancellation to platform        |
//! | `resolve_dispute`         | platform            | Split funds between importer and exporter           |
//! | `advance_stage`           | platform            | Update cancellation stage as shipment progresses    |
//! | `stake_performance_bond`  | logistics user      | Deposit required bond (Phase 5)                     |
//! | `forfeit_bond`            | platform            | Forfeit a staked bond to importer (Phase 5)          |
//! | `get_escrow`              | anyone              | Read full escrow record                             |
//! | `get_milestones_status`   | anyone              | Check which priority milestones are still pending   |
//! | `can_release`             | anyone              | Returns true if all priority milestones confirmed   |
//! | `get_milestone_bonuses`   | anyone              | Read configured milestone bonuses (Phase 5)          |
//! | `get_performance_bond`    | anyone              | Read performance bond configuration/state (Phase 5) |

#![no_std]

use soroban_sdk::{
    contract, contractimpl, token::Client as TokenClient, Address, Env, String, Vec,
};

use crate::{
    errors::EscrowError,
    events,
    storage,
    types::{
        CancellationStage, EscrowRecord, EscrowStatus, MilestoneBonus, MilestoneConfirmation,
        MilestoneType, PerformanceBond,
    },
};

// ─── Constants ─────────────────────────────────────────────────────────────────

/// 1 USDC = 10_000_000 strobes (7 decimal places on Stellar).
pub const USDC_DECIMALS: i128 = 10_000_000;

/// Default platform fee in basis points for PRE_DEPARTURE cancellations (5%).
/// 500 bps = 5%.
pub const DEFAULT_PLATFORM_FEE_BPS: u32 = 500;

/// Basis points divisor (100% = 10_000 bps).
pub const BPS_DIVISOR: u32 = 10_000;

// ─── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct MariTradeEscrowContract;

#[contractimpl]
impl MariTradeEscrowContract {
    // ══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR — runs once at deploy time (Protocol 22+)
    // ══════════════════════════════════════════════════════════════════════════

    /// Initialize the contract with the MariTrade platform address and the
    /// USDC SAC (Stellar Asset Contract) token address.
    ///
    /// Called automatically at deployment. Cannot be called again.
    ///
    /// # Arguments
    /// * `platform`   — MariTrade's Stellar account (G... address)
    /// * `usdc_token` — USDC SAC address on the target network (C... address)
    pub fn __constructor(env: Env, platform: Address, usdc_token: Address) {
        // Guard: prevent re-initialization in case of upgrade edge cases.
        if storage::get_platform(&env).is_ok() {
            panic!("already initialized");
        }

        storage::set_platform(&env, &platform);
        storage::set_usdc_token(&env, &usdc_token);

        // Extend instance TTL to 31 days so global config never expires.
        env.storage()
            .instance()
            .extend_ttl(storage::MIN_TTL, storage::BUMP_TO);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CREATE ESCROW
    // ══════════════════════════════════════════════════════════════════════════

    /// Register a new shipment escrow vault.
    ///
    /// Called by the importer immediately after the exporter accepts the deal.
    /// Corresponds to Step 4 "Fund Escrow" in the NewShipmentPage flow —
    /// specifically the pre-funding record creation step.
    ///
    /// # Arguments
    /// * `reference_code`      — MariTrade ref code (e.g. "MT-2026-00042")
    /// * `importer`            — Importer's Stellar address
    /// * `exporter`            — Exporter's Stellar address
    /// * `amount`              — USDC amount in strobes (totalValueUSD * 10_000_000)
    /// * `required_milestones` — Priority milestones the importer selects in Step 3
    /// * `partial_refund_bps`  — Refund % if cancelled pre-departure (0–10_000 bps)
    /// * `milestone_bonuses`   — Optional per-milestone speed bonuses (Phase 5). Each
    ///   entry's `milestone_type` must be in `required_milestones`, `bonus_amount` > 0,
    ///   and `sla_ledgers` > 0. Pass an empty Vec for no bonuses. The `paid` field on
    ///   each entry is ignored — the contract always stores it as `false`.
    /// * `bond_logistics_user` — Address required to stake the performance bond.
    ///   Ignored when `bond_amount == 0`; pass the importer's own address as a
    ///   harmless placeholder in that case.
    /// * `bond_amount`         — USDC performance bond in strobes. `0` means no bond
    ///   is required for this shipment (Phase 5).
    ///
    /// # Errors
    /// * `AlreadyInitialized`  — Escrow with this reference code already exists
    /// * `InvalidInitParams`   — Empty milestones, zero amount, or invalid bps
    /// * `InvalidBonusParams`  — A bonus references a non-required milestone, or has
    ///   a non-positive `bonus_amount` / `sla_ledgers`
    pub fn create_escrow(
        env: Env,
        reference_code: String,
        importer: Address,
        exporter: Address,
        amount: i128,
        required_milestones: Vec<MilestoneType>,
        partial_refund_bps: u32,
        milestone_bonuses: Vec<MilestoneBonus>,
        bond_logistics_user: Address,
        bond_amount: i128,
    ) -> Result<(), EscrowError> {
        // Only the importer can create their own escrow.
        importer.require_auth();

        // Validate inputs.
        if amount <= 0 {
            return Err(EscrowError::InvalidInitParams);
        }
        if required_milestones.is_empty() {
            return Err(EscrowError::InvalidInitParams);
        }
        if partial_refund_bps > BPS_DIVISOR {
            return Err(EscrowError::InvalidBps);
        }
        if bond_amount < 0 {
            return Err(EscrowError::InvalidBonusParams);
        }

        // Validate + normalize milestone bonuses, and total the reserve.
        let mut bonus_reserve_total: i128 = 0;
        let mut normalized_bonuses: Vec<MilestoneBonus> = soroban_sdk::vec![&env];
        for bonus in milestone_bonuses.iter() {
            if bonus.bonus_amount <= 0 || bonus.sla_ledgers == 0 {
                return Err(EscrowError::InvalidBonusParams);
            }
            if !required_milestones.contains(&bonus.milestone_type) {
                return Err(EscrowError::InvalidBonusParams);
            }
            bonus_reserve_total = bonus_reserve_total
                .checked_add(bonus.bonus_amount)
                .ok_or(EscrowError::ArithmeticError)?;
            normalized_bonuses.push_back(MilestoneBonus {
                milestone_type: bonus.milestone_type.clone(),
                bonus_amount: bonus.bonus_amount,
                sla_ledgers: bonus.sla_ledgers,
                paid: false,
            });
        }

        // Prevent duplicate escrows for the same reference code.
        if storage::escrow_exists(&env, &reference_code) {
            return Err(EscrowError::AlreadyInitialized);
        }

        let platform = storage::get_platform(&env)?;
        let usdc_token = storage::get_usdc_token(&env)?;
        let current_ledger = env.ledger().sequence();

        let record = EscrowRecord {
            platform,
            importer: importer.clone(),
            exporter: exporter.clone(),
            reference_code: reference_code.clone(),
            usdc_token,
            amount,
            partial_refund_bps,
            required_milestones,
            confirmed_milestones: soroban_sdk::vec![&env],
            milestone_bonuses: normalized_bonuses,
            bonus_reserve_remaining: bonus_reserve_total,
            performance_bond: PerformanceBond {
                logistics_user: bond_logistics_user,
                bond_amount,
                staked: false,
                resolved: false,
            },
            status: EscrowStatus::Unfunded,
            cancellation_stage: CancellationStage::Unfunded,
            created_at_ledger: current_ledger,
            funded_at_ledger: 0,
        };

        storage::set_escrow(&env, &reference_code, &record);

        events::emit_initialized(&env, &reference_code, &importer, &exporter);
        events::emit_status_changed(&env, &reference_code, &EscrowStatus::Unfunded);

        Ok(())
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ASSIGN LOGISTICS USERS
    // ══════════════════════════════════════════════════════════════════════════

    /// Assign logistics chain users who are permitted to confirm milestones.
    ///
    /// Corresponds to Step 3 "Assign Logistics Users" in the shipment create flow.
    /// Can be called multiple times to add new users (replaces the existing list).
    ///
    /// # Arguments
    /// * `reference_code` — Shipment reference code
    /// * `importer`       — Must be the importer who created this escrow
    /// * `users`          — Vec of logistics user Stellar addresses
    pub fn assign_logistics_users(
        env: Env,
        reference_code: String,
        importer: Address,
        users: Vec<Address>,
    ) -> Result<(), EscrowError> {
        importer.require_auth();

        let record = storage::get_escrow(&env, &reference_code)?;

        // Only the importer on this shipment can assign users.
        if record.importer != importer {
            return Err(EscrowError::NotImporter);
        }

        // Logistics users can only be modified while escrow is not yet settled.
        if matches!(
            record.status,
            EscrowStatus::Released | EscrowStatus::Refunded
        ) {
            return Err(EscrowError::AlreadySettled);
        }

        storage::set_logistics_users(&env, &reference_code, &users);

        Ok(())
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FUND
    // ══════════════════════════════════════════════════════════════════════════

    /// Deposit USDC into the escrow vault.
    ///
    /// Pulls `amount` USDC from the importer's wallet into the contract account
    /// using the SAC `transfer` operation. The importer must have approved the
    /// allowance or be signing via Freighter / Wallet Kit.
    ///
    /// Corresponds to the "Fund Escrow via Stellar" button in Step 4.
    ///
    /// # Arguments
    /// * `reference_code` — Shipment reference code
    /// * `importer`       — Must match the importer on the escrow record
    ///
    /// # Errors
    /// * `AlreadyFunded`  — Escrow has already been funded
    /// * `NotImporter`    — Caller is not the importer on this escrow
    pub fn fund(
        env: Env,
        reference_code: String,
        importer: Address,
    ) -> Result<(), EscrowError> {
        importer.require_auth();

        let mut record = storage::get_escrow(&env, &reference_code)?;

        if record.importer != importer {
            return Err(EscrowError::NotImporter);
        }
        if record.status != EscrowStatus::Unfunded {
            return Err(EscrowError::AlreadyFunded);
        }

        // Transfer USDC from importer → this contract (escrow vault).
        // Pulls `amount` plus any milestone-bonus reserve in a single transfer so
        // bonuses are fully pre-funded alongside the base escrow amount.
        let total_to_pull = record
            .amount
            .checked_add(record.bonus_reserve_remaining)
            .ok_or(EscrowError::ArithmeticError)?;
        let token = TokenClient::new(&env, &record.usdc_token);
        token.transfer(
            &importer,
            &env.current_contract_address(),
            &total_to_pull,
        );

        // Update state.
        record.status = EscrowStatus::Funded;
        record.cancellation_stage = CancellationStage::PreDeparture;
        record.funded_at_ledger = env.ledger().sequence();

        storage::set_escrow(&env, &reference_code, &record);

        events::emit_funded(&env, &reference_code, &importer, record.amount);
        events::emit_status_changed(&env, &reference_code, &EscrowStatus::Funded);

        Ok(())
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CONFIRM MILESTONE
    // ══════════════════════════════════════════════════════════════════════════

    /// Record a confirmed milestone event on-chain.
    ///
    /// Only callable by an address in the logistics users list for this shipment.
    /// Requires an evidence URI (IPFS CID or URL) — matches the product rule:
    /// "Proof upload is REQUIRED for milestone submission."
    ///
    /// # Arguments
    /// * `reference_code`  — Shipment reference code
    /// * `confirmer`       — Logistics user confirming this milestone
    /// * `milestone_type`  — The MilestoneType being confirmed
    /// * `evidence_uri`    — Proof document URI (IPFS hash or HTTPS URL)
    ///
    /// # Errors
    /// * `EscrowNotActive`             — Escrow is not in Funded state
    /// * `NotAuthorizedLogisticsUser`  — Caller not in logistics user list
    /// * `MilestoneNotRequired`        — Milestone not in importer's priority list
    /// * `MilestoneAlreadyConfirmed`   — Milestone already recorded
    /// * `MissingEvidence`             — Evidence URI is empty
    pub fn confirm_milestone(
        env: Env,
        reference_code: String,
        confirmer: Address,
        milestone_type: MilestoneType,
        evidence_uri: String,
    ) -> Result<(), EscrowError> {
        confirmer.require_auth();

        // Evidence is mandatory — API-level enforcement on-chain.
        if evidence_uri.len() == 0 {
            return Err(EscrowError::MissingEvidence);
        }

        let mut record = storage::get_escrow(&env, &reference_code)?;

        // Escrow must be active (funded) to accept milestone confirmations.
        if record.status != EscrowStatus::Funded {
            return Err(EscrowError::EscrowNotActive);
        }

        // Confirm caller is an authorized logistics user.
        if !storage::is_logistics_user(&env, &reference_code, &confirmer) {
            return Err(EscrowError::NotAuthorizedLogisticsUser);
        }

        // Confirm the milestone is in the importer's required list.
        if !record.required_milestones.contains(&milestone_type) {
            return Err(EscrowError::MilestoneNotRequired);
        }

        // Confirm it hasn't been confirmed before.
        for already in record.confirmed_milestones.iter() {
            if already.milestone_type == milestone_type {
                return Err(EscrowError::MilestoneAlreadyConfirmed);
            }
        }

        // Record the confirmation.
        let confirmed_at_ledger = env.ledger().sequence();
        let confirmation = MilestoneConfirmation {
            milestone_type: milestone_type.clone(),
            confirmed_by: confirmer.clone(),
            confirmed_at_ledger,
            evidence_uri: evidence_uri.clone(),
        };

        record.confirmed_milestones.push_back(confirmation);

        // ── Speed bonus payout (Phase 5) ──────────────────────────────────
        // If this milestone has a configured bonus and is confirmed within its
        // SLA window (measured from `funded_at_ledger`), pay it out to the
        // confirming logistics user immediately.
        let mut updated_bonuses: Vec<MilestoneBonus> = soroban_sdk::vec![&env];
        let mut bonus_to_pay: i128 = 0;
        for bonus in record.milestone_bonuses.iter() {
            if !bonus.paid
                && bonus.milestone_type == milestone_type
                && confirmed_at_ledger <= record.funded_at_ledger.saturating_add(bonus.sla_ledgers)
            {
                bonus_to_pay = bonus.bonus_amount;
                updated_bonuses.push_back(MilestoneBonus {
                    milestone_type: bonus.milestone_type.clone(),
                    bonus_amount: bonus.bonus_amount,
                    sla_ledgers: bonus.sla_ledgers,
                    paid: true,
                });
            } else {
                updated_bonuses.push_back(bonus.clone());
            }
        }
        record.milestone_bonuses = updated_bonuses;

        if bonus_to_pay > 0 {
            let token = TokenClient::new(&env, &record.usdc_token);
            token.transfer(&env.current_contract_address(), &confirmer, &bonus_to_pay);
            record.bonus_reserve_remaining = record
                .bonus_reserve_remaining
                .checked_sub(bonus_to_pay)
                .ok_or(EscrowError::ArithmeticError)?;

            events::emit_bonus_paid(&env, &reference_code, &milestone_type, &confirmer, bonus_to_pay);
        }

        storage::set_escrow(&env, &reference_code, &record);

        events::emit_milestone_confirmed(
            &env,
            &reference_code,
            &milestone_type,
            &confirmer,
            &evidence_uri,
        );

        Ok(())
    }

    // ══════════════════════════════════════════════════════════════════════════
    // RELEASE
    // ══════════════════════════════════════════════════════════════════════════

    /// Release USDC from the escrow vault to the exporter.
    ///
    /// The "Release Funds" button in the shipment detail escrow panel calls this.
    /// All priority milestones must be confirmed before this is permitted.
    ///
    /// # Arguments
    /// * `reference_code` — Shipment reference code
    /// * `importer`       — Must be the importer on this escrow
    ///
    /// # Errors
    /// * `PriorityMilestonesIncomplete` — Not all required milestones confirmed
    /// * `NotFunded`                    — Escrow is not in Funded state
    /// * `AlreadySettled`               — Already released or refunded
    pub fn release(
        env: Env,
        reference_code: String,
        importer: Address,
    ) -> Result<(), EscrowError> {
        importer.require_auth();

        let mut record = storage::get_escrow(&env, &reference_code)?;

        if record.importer != importer {
            return Err(EscrowError::NotImporter);
        }
        if record.status != EscrowStatus::Funded {
            return Err(EscrowError::NotFunded);
        }

        // Enforce the milestone gate — all priority milestones must be confirmed.
        Self::assert_all_milestones_confirmed(&record)?;

        let token = TokenClient::new(&env, &record.usdc_token);

        // Transfer USDC from contract → exporter.
        token.transfer(
            &env.current_contract_address(),
            &record.exporter,
            &record.amount,
        );

        // ── Return any unclaimed bonus reserve (missed SLA windows) ────────
        if record.bonus_reserve_remaining > 0 {
            let unclaimed = record.bonus_reserve_remaining;
            token.transfer(&env.current_contract_address(), &record.importer, &unclaimed);
            record.bonus_reserve_remaining = 0;
            events::emit_bonus_reserve_returned(&env, &reference_code, &record.importer, unclaimed);
        }

        // ── Redeem the performance bond on clean delivery ──────────────────
        if record.performance_bond.staked && !record.performance_bond.resolved {
            let bond_amount = record.performance_bond.bond_amount;
            let logistics_user = record.performance_bond.logistics_user.clone();
            token.transfer(&env.current_contract_address(), &logistics_user, &bond_amount);
            record.performance_bond.resolved = true;
            events::emit_bond_redeemed(&env, &reference_code, &logistics_user, bond_amount);
        }

        record.status = EscrowStatus::Released;
        storage::set_escrow(&env, &reference_code, &record);

        events::emit_released(&env, &reference_code, &record.exporter, record.amount);
        events::emit_status_changed(&env, &reference_code, &EscrowStatus::Released);

        Ok(())
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CANCEL
    // ══════════════════════════════════════════════════════════════════════════

    /// Cancel the escrow and refund the importer per the cancellation policy.
    ///
    /// Implements the logic from `/lib/escrow/cancellation.ts`:
    ///
    /// | Stage          | Allowed | Refund   | Who can cancel                      |
    /// |----------------|---------|----------|-------------------------------------|
    /// | UNFUNDED       | Yes     | Full     | Importer only                        |
    /// | PRE_DEPARTURE  | Yes     | Partial  | Importer + Platform must both sign   |
    /// | IN_TRANSIT     | Yes     | Disputed | Must use `raise_dispute` first       |
    /// | DELIVERED      | No      | None     | Blocked                              |
    ///
    /// # Arguments
    /// * `reference_code` — Shipment reference code
    /// * `importer`       — Must match the importer on the escrow
    /// * `platform`       — Required for PRE_DEPARTURE; pass same address as platform
    ///
    /// # Errors
    /// * `CancellationNotAllowed`            — DELIVERED stage
    /// * `RequiresPlatformArbitration`       — IN_TRANSIT; use raise_dispute instead
    /// * `RequiresBothPartiesForPreDeparture`— PRE_DEPARTURE needs both auths
    pub fn cancel(
        env: Env,
        reference_code: String,
        importer: Address,
        platform: Address,
    ) -> Result<(), EscrowError> {
        let record = storage::get_escrow(&env, &reference_code)?;

        if record.importer != importer {
            return Err(EscrowError::NotImporter);
        }
        if record.platform != platform {
            return Err(EscrowError::NotPlatform);
        }

        // Already settled — nothing to cancel.
        if matches!(
            record.status,
            EscrowStatus::Released | EscrowStatus::Refunded
        ) {
            return Err(EscrowError::AlreadySettled);
        }

        match record.cancellation_stage {
            // ── UNFUNDED: Importer alone can cancel, full refund. ─────────────
            CancellationStage::Unfunded => {
                importer.require_auth();
                // No USDC was deposited, so just mark as refunded.
                let mut r = record;
                r.status = EscrowStatus::Refunded;
                storage::set_escrow(&env, &reference_code, &r);

                events::emit_cancelled(&env, &reference_code, &importer, 0, 0);
                events::emit_status_changed(&env, &reference_code, &EscrowStatus::Refunded);
            }

            // ── PRE_DEPARTURE: Both importer + platform must sign. ───────────
            CancellationStage::PreDeparture => {
                importer.require_auth();
                platform.require_auth();

                let refund_amount = Self::calculate_partial_refund(&record)?;
                let platform_fee = record
                    .amount
                    .checked_sub(refund_amount)
                    .ok_or(EscrowError::ArithmeticError)?;

                let token = TokenClient::new(&env, &record.usdc_token);

                // Return partial refund to importer.
                if refund_amount > 0 {
                    token.transfer(
                        &env.current_contract_address(),
                        &record.importer,
                        &refund_amount,
                    );
                }

                // Platform retains the remaining fee.
                if platform_fee > 0 {
                    token.transfer(
                        &env.current_contract_address(),
                        &record.platform,
                        &platform_fee,
                    );
                }

                let mut r = record;

                // Return any unclaimed bonus reserve to the importer — a cancelled
                // shipment never progressed far enough for further bonuses to apply.
                if r.bonus_reserve_remaining > 0 {
                    let unclaimed = r.bonus_reserve_remaining;
                    token.transfer(&env.current_contract_address(), &r.importer, &unclaimed);
                    r.bonus_reserve_remaining = 0;
                    events::emit_bonus_reserve_returned(&env, &reference_code, &r.importer, unclaimed);
                }

                // A neutral cancellation (no fault determined) returns any staked
                // bond to the logistics user rather than forfeiting it.
                if r.performance_bond.staked && !r.performance_bond.resolved {
                    let bond_amount = r.performance_bond.bond_amount;
                    let logistics_user = r.performance_bond.logistics_user.clone();
                    token.transfer(&env.current_contract_address(), &logistics_user, &bond_amount);
                    r.performance_bond.resolved = true;
                    events::emit_bond_redeemed(&env, &reference_code, &logistics_user, bond_amount);
                }

                r.status = EscrowStatus::Refunded;
                storage::set_escrow(&env, &reference_code, &r);

                events::emit_cancelled(
                    &env,
                    &reference_code,
                    &importer,
                    refund_amount,
                    platform_fee,
                );
                events::emit_status_changed(&env, &reference_code, &EscrowStatus::Refunded);
            }

            // ── IN_TRANSIT: Must go through raise_dispute first. ─────────────
            CancellationStage::InTransit => {
                return Err(EscrowError::RequiresPlatformArbitration);
            }

            // ── DELIVERED: No cancellation allowed. ──────────────────────────
            CancellationStage::Delivered => {
                return Err(EscrowError::CancellationNotAllowed);
            }
        }

        Ok(())
    }

    // ══════════════════════════════════════════════════════════════════════════
    // RAISE DISPUTE (IN_TRANSIT cancellation)
    // ══════════════════════════════════════════════════════════════════════════

    /// Escalate an in-transit shipment to disputed status for platform arbitration.
    ///
    /// Only callable by the importer when `cancellation_stage == IN_TRANSIT`.
    /// After this, the platform calls `resolve_dispute` to split funds.
    pub fn raise_dispute(
        env: Env,
        reference_code: String,
        importer: Address,
    ) -> Result<(), EscrowError> {
        importer.require_auth();

        let mut record = storage::get_escrow(&env, &reference_code)?;

        if record.importer != importer {
            return Err(EscrowError::NotImporter);
        }
        if record.cancellation_stage != CancellationStage::InTransit {
            return Err(EscrowError::RequiresPlatformArbitration);
        }
        if record.status == EscrowStatus::Disputed {
            return Err(EscrowError::AlreadyDisputed);
        }
        if matches!(
            record.status,
            EscrowStatus::Released | EscrowStatus::Refunded
        ) {
            return Err(EscrowError::AlreadySettled);
        }

        record.status = EscrowStatus::Disputed;
        storage::set_escrow(&env, &reference_code, &record);

        events::emit_disputed(&env, &reference_code, &importer);
        events::emit_status_changed(&env, &reference_code, &EscrowStatus::Disputed);

        Ok(())
    }

    // ══════════════════════════════════════════════════════════════════════════
    // RESOLVE DISPUTE
    // ══════════════════════════════════════════════════════════════════════════

    /// Platform-only: resolve a disputed escrow by splitting funds.
    ///
    /// `importer_bps + exporter_bps` must equal 10_000 (100%).
    /// MariTrade platform can retain a portion if needed (via platform_bps).
    ///
    /// # Arguments
    /// * `reference_code` — Shipment reference code
    /// * `platform`       — Must match the platform address
    /// * `importer_bps`   — Basis points to refund to importer (0–10_000)
    /// * `exporter_bps`   — Basis points to pay to exporter (0–10_000)
    ///
    /// Note: Any remainder (10_000 - importer_bps - exporter_bps) is retained
    /// by the platform as an arbitration fee.
    pub fn resolve_dispute(
        env: Env,
        reference_code: String,
        platform: Address,
        importer_bps: u32,
        exporter_bps: u32,
    ) -> Result<(), EscrowError> {
        platform.require_auth();

        let record = storage::get_escrow(&env, &reference_code)?;

        if record.platform != platform {
            return Err(EscrowError::NotPlatform);
        }
        if record.status != EscrowStatus::Disputed {
            return Err(EscrowError::OnlyPlatformCanResolveDispute);
        }

        // Validate split — cannot exceed 100%.
        let total_bps = importer_bps
            .checked_add(exporter_bps)
            .ok_or(EscrowError::ArithmeticError)?;
        if total_bps > BPS_DIVISOR {
            return Err(EscrowError::InvalidBps);
        }

        let total = record.amount;
        let importer_amount = Self::bps_of(total, importer_bps)?;
        let exporter_amount = Self::bps_of(total, exporter_bps)?;
        let platform_fee = total
            .checked_sub(importer_amount)
            .and_then(|v| v.checked_sub(exporter_amount))
            .ok_or(EscrowError::ArithmeticError)?;

        let token = TokenClient::new(&env, &record.usdc_token);

        if importer_amount > 0 {
            token.transfer(
                &env.current_contract_address(),
                &record.importer,
                &importer_amount,
            );
        }
        if exporter_amount > 0 {
            token.transfer(
                &env.current_contract_address(),
                &record.exporter,
                &exporter_amount,
            );
        }
        if platform_fee > 0 {
            token.transfer(
                &env.current_contract_address(),
                &record.platform,
                &platform_fee,
            );
        }

        let mut r = record;

        // Return any unclaimed bonus reserve to the importer.
        if r.bonus_reserve_remaining > 0 {
            let unclaimed = r.bonus_reserve_remaining;
            token.transfer(&env.current_contract_address(), &r.importer, &unclaimed);
            r.bonus_reserve_remaining = 0;
            events::emit_bonus_reserve_returned(&env, &reference_code, &r.importer, unclaimed);
        }

        // If the platform did not forfeit the bond via `forfeit_bond` before
        // calling this, it is redeemed back to the logistics user by default.
        if r.performance_bond.staked && !r.performance_bond.resolved {
            let bond_amount = r.performance_bond.bond_amount;
            let logistics_user = r.performance_bond.logistics_user.clone();
            token.transfer(&env.current_contract_address(), &logistics_user, &bond_amount);
            r.performance_bond.resolved = true;
            events::emit_bond_redeemed(&env, &reference_code, &logistics_user, bond_amount);
        }

        r.status = EscrowStatus::Refunded;
        storage::set_escrow(&env, &reference_code, &r);

        events::emit_dispute_resolved(
            &env,
            &reference_code,
            &r.importer,
            &r.exporter,
            importer_amount,
            exporter_amount,
        );
        events::emit_status_changed(&env, &reference_code, &EscrowStatus::Refunded);

        Ok(())
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ADVANCE STAGE
    // ══════════════════════════════════════════════════════════════════════════

    /// Platform-only: advance the cancellation stage as the shipment progresses.
    ///
    /// Called by MariTrade backend when key milestones are logged:
    /// - VESSEL_DEPARTED_ORIGIN   → IN_TRANSIT
    /// - DELIVERED_AND_SIGNED_OFF → DELIVERED
    ///
    /// This controls which cancellation policy applies per the product spec.
    pub fn advance_stage(
        env: Env,
        reference_code: String,
        platform: Address,
        new_stage: CancellationStage,
    ) -> Result<(), EscrowError> {
        platform.require_auth();

        let mut record = storage::get_escrow(&env, &reference_code)?;

        if record.platform != platform {
            return Err(EscrowError::NotPlatform);
        }

        // Stages can only advance forward (Unfunded → PreDeparture → InTransit → Delivered).
        let current_ord = record.cancellation_stage.clone() as u32;
        let new_ord = new_stage.clone() as u32;
        if new_ord <= current_ord {
            // Silent no-op if already at or past this stage (idempotent).
            return Ok(());
        }

        record.cancellation_stage = new_stage;
        storage::set_escrow(&env, &reference_code, &record);

        Ok(())
    }

    /// Deposit the required USDC performance bond for a high-value shipment.
    /// Phase 5 — Escrow-as-Incentive.
    ///
    /// Only callable by the exact `logistics_user` address configured in
    /// `create_escrow`. A shipment with no bond requirement (`bond_amount == 0`)
    /// rejects this call.
    ///
    /// # Errors
    /// * `BondNotRequired`      — This shipment has no bond requirement
    /// * `NotBondLogisticsUser` — Caller isn't the assigned bond-holder
    /// * `BondAlreadyStaked`    — Bond has already been deposited
    pub fn stake_performance_bond(
        env: Env,
        reference_code: String,
        logistics_user: Address,
    ) -> Result<(), EscrowError> {
        logistics_user.require_auth();

        let mut record = storage::get_escrow(&env, &reference_code)?;

        if record.performance_bond.bond_amount <= 0 {
            return Err(EscrowError::BondNotRequired);
        }
        if record.performance_bond.logistics_user != logistics_user {
            return Err(EscrowError::NotBondLogisticsUser);
        }
        if record.performance_bond.staked {
            return Err(EscrowError::BondAlreadyStaked);
        }

        let token = TokenClient::new(&env, &record.usdc_token);
        token.transfer(
            &logistics_user,
            &env.current_contract_address(),
            &record.performance_bond.bond_amount,
        );

        record.performance_bond.staked = true;
        let bond_amount = record.performance_bond.bond_amount;
        storage::set_escrow(&env, &reference_code, &record);

        events::emit_bond_staked(&env, &reference_code, &logistics_user, bond_amount);

        Ok(())
    }

    /// Platform-only: forfeit a staked performance bond to the importer after
    /// confirming damage or a dispute loss by the logistics user. Phase 5 —
    /// Escrow-as-Incentive.
    ///
    /// Must be called **before** `resolve_dispute` — once `resolve_dispute` runs,
    /// the escrow leaves the `Disputed` status and any still-staked bond is
    /// redeemed back to the logistics user automatically (no-fault default).
    ///
    /// # Errors
    /// * `NotPlatform`  — Caller is not the platform address
    /// * `BondNotStaked` — No staked, unresolved bond exists for this escrow
    /// * `OnlyPlatformCanResolveDispute` — Escrow is not currently `Disputed`
    pub fn forfeit_bond(
        env: Env,
        reference_code: String,
        platform: Address,
    ) -> Result<(), EscrowError> {
        platform.require_auth();

        let mut record = storage::get_escrow(&env, &reference_code)?;

        if record.platform != platform {
            return Err(EscrowError::NotPlatform);
        }
        if record.status != EscrowStatus::Disputed {
            return Err(EscrowError::OnlyPlatformCanResolveDispute);
        }
        if !record.performance_bond.staked || record.performance_bond.resolved {
            return Err(EscrowError::BondNotStaked);
        }

        let token = TokenClient::new(&env, &record.usdc_token);
        let bond_amount = record.performance_bond.bond_amount;
        token.transfer(&env.current_contract_address(), &record.importer, &bond_amount);

        record.performance_bond.resolved = true;
        storage::set_escrow(&env, &reference_code, &record);

        events::emit_bond_forfeited(&env, &reference_code, &record.importer, bond_amount);

        Ok(())
    }

    // ══════════════════════════════════════════════════════════════════════════
    // READ-ONLY QUERIES
    // ══════════════════════════════════════════════════════════════════════════

    /// Return the full escrow record for a given shipment.
    pub fn get_escrow(env: Env, reference_code: String) -> Result<EscrowRecord, EscrowError> {
        storage::get_escrow(&env, &reference_code)
    }

    /// Return true if all priority milestones have been confirmed.
    /// Used by the frontend to enable/disable the "Release Funds" button.
    pub fn can_release(env: Env, reference_code: String) -> Result<bool, EscrowError> {
        let record = storage::get_escrow(&env, &reference_code)?;
        Ok(Self::assert_all_milestones_confirmed(&record).is_ok())
    }

    /// Return the list of required milestones that have NOT yet been confirmed.
    /// Useful for the shipment detail page milestone gate panel.
    pub fn get_pending_milestones(
        env: Env,
        reference_code: String,
    ) -> Result<Vec<MilestoneType>, EscrowError> {
        let record = storage::get_escrow(&env, &reference_code)?;

        let mut pending = soroban_sdk::vec![&env];
        for required in record.required_milestones.iter() {
            let mut found = false;
            for confirmed in record.confirmed_milestones.iter() {
                if confirmed.milestone_type == required {
                    found = true;
                    break;
                }
            }
            if !found {
                pending.push_back(required);
            }
        }

        Ok(pending)
    }

    /// Return the current escrow status for a shipment reference code.
    pub fn get_status(env: Env, reference_code: String) -> Result<EscrowStatus, EscrowError> {
        let record = storage::get_escrow(&env, &reference_code)?;
        Ok(record.status)
    }

    /// Return the list of confirmed milestone confirmations.
    pub fn get_confirmed_milestones(
        env: Env,
        reference_code: String,
    ) -> Result<Vec<MilestoneConfirmation>, EscrowError> {
        let record = storage::get_escrow(&env, &reference_code)?;
        Ok(record.confirmed_milestones)
    }

    /// Return the configured milestone bonuses (Phase 5) and their paid status.
    pub fn get_milestone_bonuses(
        env: Env,
        reference_code: String,
    ) -> Result<Vec<MilestoneBonus>, EscrowError> {
        let record = storage::get_escrow(&env, &reference_code)?;
        Ok(record.milestone_bonuses)
    }

    /// Return the performance bond configuration/state for a shipment (Phase 5).
    /// `bond_amount == 0` means no bond is required.
    pub fn get_performance_bond(
        env: Env,
        reference_code: String,
    ) -> Result<PerformanceBond, EscrowError> {
        let record = storage::get_escrow(&env, &reference_code)?;
        Ok(record.performance_bond)
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    /// Check that every milestone in `required_milestones` has a matching
    /// entry in `confirmed_milestones`. Returns an error if any are missing.
    fn assert_all_milestones_confirmed(record: &EscrowRecord) -> Result<(), EscrowError> {
        for required in record.required_milestones.iter() {
            let mut found = false;
            for confirmed in record.confirmed_milestones.iter() {
                if confirmed.milestone_type == required {
                    found = true;
                    break;
                }
            }
            if !found {
                return Err(EscrowError::PriorityMilestonesIncomplete);
            }
        }
        Ok(())
    }

    /// Calculate how much USDC to refund to the importer for a PRE_DEPARTURE
    /// cancellation, based on the `partial_refund_bps` set at escrow creation.
    fn calculate_partial_refund(record: &EscrowRecord) -> Result<i128, EscrowError> {
        Self::bps_of(record.amount, record.partial_refund_bps)
    }

    /// Apply a basis-points percentage to an i128 amount.
    /// Result is floor-rounded (integer division).
    fn bps_of(amount: i128, bps: u32) -> Result<i128, EscrowError> {
        let result = amount
            .checked_mul(bps as i128)
            .ok_or(EscrowError::ArithmeticError)?
            .checked_div(BPS_DIVISOR as i128)
            .ok_or(EscrowError::ArithmeticError)?;
        Ok(result)
    }
}
