//! On-chain events emitted by the MariTrade escrow contract.
//!
//! Events are indexed by Stellar RPC and Horizon, making them
//! queryable by the MariTrade Next.js backend via `watchAccount`
//! or direct RPC event streaming.

#![no_std]

use soroban_sdk::{symbol_short, Address, Env, String};

use crate::types::{EscrowStatus, MilestoneType};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: emit a two-topic event with a data payload.
// Topics: [contract_symbol, event_name]  —  Data: arbitrary contracttype value.
// ─────────────────────────────────────────────────────────────────────────────

/// Emitted when the escrow contract is successfully initialized.
pub fn emit_initialized(env: &Env, reference_code: &String, importer: &Address, exporter: &Address) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("init")),
        (reference_code.clone(), importer.clone(), exporter.clone()),
    );
}

/// Emitted when the importer successfully deposits USDC into the escrow vault.
pub fn emit_funded(env: &Env, reference_code: &String, importer: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("funded")),
        (reference_code.clone(), importer.clone(), amount),
    );
}

/// Emitted when a logistics user confirms a milestone event.
///
/// `evidence_uri` is stored in the event data so MariTrade backend
/// can index it without a separate storage read.
pub fn emit_milestone_confirmed(
    env: &Env,
    reference_code: &String,
    milestone_type: &MilestoneType,
    confirmed_by: &Address,
    evidence_uri: &String,
) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("milestone")),
        (
            reference_code.clone(),
            milestone_type.clone(),
            confirmed_by.clone(),
            evidence_uri.clone(),
        ),
    );
}

/// Emitted when all priority milestones are confirmed AND the importer
/// calls `release` — funds are transferred to the exporter.
pub fn emit_released(
    env: &Env,
    reference_code: &String,
    exporter: &Address,
    amount: i128,
) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("released")),
        (reference_code.clone(), exporter.clone(), amount),
    );
}

/// Emitted when an escrow is cancelled and a refund is sent.
///
/// `refund_amount` is the USDC actually returned to the importer.
/// `platform_fee`  is any amount retained by MariTrade (0 for UNFUNDED stage).
pub fn emit_cancelled(
    env: &Env,
    reference_code: &String,
    importer: &Address,
    refund_amount: i128,
    platform_fee: i128,
) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("cancelled")),
        (
            reference_code.clone(),
            importer.clone(),
            refund_amount,
            platform_fee,
        ),
    );
}

/// Emitted when the escrow is flagged as disputed (IN_TRANSIT cancellation).
pub fn emit_disputed(env: &Env, reference_code: &String, raised_by: &Address) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("disputed")),
        (reference_code.clone(), raised_by.clone()),
    );
}

/// Emitted when the platform resolves a dispute by splitting the funds.
///
/// `importer_amount` + `exporter_amount` == total locked amount.
pub fn emit_dispute_resolved(
    env: &Env,
    reference_code: &String,
    importer: &Address,
    exporter: &Address,
    importer_amount: i128,
    exporter_amount: i128,
) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("resolved")),
        (
            reference_code.clone(),
            importer.clone(),
            exporter.clone(),
            importer_amount,
            exporter_amount,
        ),
    );
}

/// Emitted when escrow status changes (general state machine tracker).
pub fn emit_status_changed(env: &Env, reference_code: &String, new_status: &EscrowStatus) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("status")),
        (reference_code.clone(), new_status.clone()),
    );
}

// ─── Escrow-as-incentive events (Phase 5) ───────────────────────────────

/// Emitted when a milestone speed bonus is paid out to a logistics user.
pub fn emit_bonus_paid(
    env: &Env,
    reference_code: &String,
    milestone_type: &MilestoneType,
    paid_to: &Address,
    amount: i128,
) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("bonuspaid")),
        (
            reference_code.clone(),
            milestone_type.clone(),
            paid_to.clone(),
            amount,
        ),
    );
}

/// Emitted when any unclaimed bonus reserve (missed SLA windows) is returned
/// to the importer at settlement time.
pub fn emit_bonus_reserve_returned(
    env: &Env,
    reference_code: &String,
    importer: &Address,
    amount: i128,
) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("bonusret")),
        (reference_code.clone(), importer.clone(), amount),
    );
}

/// Emitted when a logistics user stakes their required performance bond.
pub fn emit_bond_staked(
    env: &Env,
    reference_code: &String,
    logistics_user: &Address,
    amount: i128,
) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("bondstake")),
        (reference_code.clone(), logistics_user.clone(), amount),
    );
}

/// Emitted when a staked performance bond is redeemed back to the logistics
/// user on clean delivery.
pub fn emit_bond_redeemed(
    env: &Env,
    reference_code: &String,
    logistics_user: &Address,
    amount: i128,
) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("bondredm")),
        (reference_code.clone(), logistics_user.clone(), amount),
    );
}

/// Emitted when the platform forfeits a staked performance bond to the
/// importer following a confirmed damage / dispute loss.
pub fn emit_bond_forfeited(
    env: &Env,
    reference_code: &String,
    importer: &Address,
    amount: i128,
) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("bondforf")),
        (reference_code.clone(), importer.clone(), amount),
    );
}
