//! Integration tests for the MariTrade escrow contract.
//!
//! Each test covers a complete lifecycle path using Soroban's testutils
//! environment — no network required.
//!
//! NOTE: The Soroban `contractimpl` macro generates client methods that return
//! the raw type directly (not wrapped in Result). Only `try_*` variants return
//! Result. Success-path calls must NOT call `.unwrap()`.

#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{Client as TokenClient, StellarAssetClient},
    vec, Address, Env, String,
};

use crate::{
    errors::EscrowError,
    types::{CancellationStage, EscrowStatus, MilestoneBonus, MilestoneType},
    MariTradeEscrowContract,
    MariTradeEscrowContractClient,
};

// ─── Test helpers ──────────────────────────────────────────────────────────────

/// USDC amount used across tests: 10_000 USDC (7 decimals).
const ESCROW_AMOUNT: i128 = 10_000 * 10_000_000;

struct TestEnv {
    env: Env,
    /// Deployed escrow contract address — use with `MariTradeEscrowContractClient::new`.
    contract_address: Address,
    usdc: Address,
    platform: Address,
    importer: Address,
    exporter: Address,
    logistics_user: Address,
    ref_code: String,
}

impl TestEnv {
    fn setup() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        // Deploy a mock USDC Stellar Asset Contract.
        let usdc_admin = Address::generate(&env);
        let usdc = env.register_stellar_asset_contract_v2(usdc_admin.clone());
        let usdc_address = usdc.address();

        // Mint USDC to the importer and the logistics user (for bond staking).
        let importer = Address::generate(&env);
        let logistics_user = Address::generate(&env);
        StellarAssetClient::new(&env, &usdc_address).mint(&importer, &(ESCROW_AMOUNT * 10));
        StellarAssetClient::new(&env, &usdc_address).mint(&logistics_user, &(ESCROW_AMOUNT * 10));

        let platform = Address::generate(&env);
        let exporter = Address::generate(&env);

        // Deploy the escrow contract — constructor receives (platform, usdc_token).
        let contract_address = env.register(
            MariTradeEscrowContract,
            (platform.clone(), usdc_address.clone()),
        );

        let ref_code = String::from_str(&env, "MT-2026-00001");

        TestEnv {
            env,
            contract_address,
            usdc: usdc_address,
            platform,
            importer,
            exporter,
            logistics_user,
            ref_code,
        }
    }

    /// Convenience: build a client bound to this TestEnv's lifetime.
    fn client(&self) -> MariTradeEscrowContractClient<'_> {
        MariTradeEscrowContractClient::new(&self.env, &self.contract_address)
    }

    /// Standard required milestones for most tests.
    fn default_milestones(&self) -> soroban_sdk::Vec<MilestoneType> {
        vec![
            &self.env,
            MilestoneType::VesselDepartedOrigin,
            MilestoneType::CustomsClearanceApproved,
            MilestoneType::DeliveredAndSignedOff,
        ]
    }

    fn evidence_uri(&self) -> String {
        String::from_str(&self.env, "ipfs://QmTestHash123")
    }

    /// Empty milestone-bonus list — most tests don't exercise Phase 5 bonuses.
    fn no_bonuses(&self) -> soroban_sdk::Vec<MilestoneBonus> {
        vec![&self.env]
    }

    /// Create an escrow with no milestone bonuses and no performance bond
    /// requirement (the pre-Phase-5 default shape).
    fn create_escrow_basic(&self) {
        self.client().create_escrow(
            &self.ref_code,
            &self.importer,
            &self.exporter,
            &ESCROW_AMOUNT,
            &self.default_milestones(),
            &8_000u32, // 80% refund if pre-departure cancel
            &self.no_bonuses(),
            &self.importer, // bond_logistics_user placeholder — unused, bond_amount = 0
            &0i128,
        );
    }

    /// Create + fund an escrow and assign logistics users — shortcut for tests
    /// that want to start from the FUNDED state.
    fn create_and_fund(&self) {
        let client = self.client();

        self.create_escrow_basic();

        client.assign_logistics_users(
            &self.ref_code,
            &self.importer,
            &vec![&self.env, self.logistics_user.clone()],
        );

        client.fund(&self.ref_code, &self.importer);
    }
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

// ── 1. Create escrow ──────────────────────────────────────────────────────────

#[test]
fn test_create_escrow_success() {
    let t = TestEnv::setup();

    t.create_escrow_basic();

    let record = t.client().get_escrow(&t.ref_code);
    assert_eq!(record.status, EscrowStatus::Unfunded);
    assert_eq!(record.importer, t.importer);
    assert_eq!(record.exporter, t.exporter);
    assert_eq!(record.amount, ESCROW_AMOUNT);
    assert_eq!(record.partial_refund_bps, 8_000u32);
    assert_eq!(record.required_milestones.len(), 3);
    assert_eq!(record.bonus_reserve_remaining, 0);
    assert_eq!(record.performance_bond.bond_amount, 0);
}

#[test]
fn test_create_escrow_duplicate_rejected() {
    let t = TestEnv::setup();

    t.create_escrow_basic();

    // Same ref code → AlreadyInitialized.
    let err = t
        .client()
        .try_create_escrow(
            &t.ref_code,
            &t.importer,
            &t.exporter,
            &ESCROW_AMOUNT,
            &t.default_milestones(),
            &8_000u32,
            &t.no_bonuses(),
            &t.importer,
            &0i128,
        )
        .unwrap_err()
        .unwrap();

    assert_eq!(err, EscrowError::AlreadyInitialized);
}

#[test]
fn test_create_escrow_invalid_bps_rejected() {
    let t = TestEnv::setup();

    // 10_001 bps > 10_000 → InvalidBps.
    let err = t
        .client()
        .try_create_escrow(
            &t.ref_code,
            &t.importer,
            &t.exporter,
            &ESCROW_AMOUNT,
            &t.default_milestones(),
            &10_001u32,
            &t.no_bonuses(),
            &t.importer,
            &0i128,
        )
        .unwrap_err()
        .unwrap();

    assert_eq!(err, EscrowError::InvalidBps);
}

#[test]
fn test_create_escrow_bonus_on_non_required_milestone_rejected() {
    let t = TestEnv::setup();

    // BookingConfirmed is NOT in the default required list.
    let bad_bonus = MilestoneBonus {
        milestone_type: MilestoneType::BookingConfirmed,
        bonus_amount: 100 * 10_000_000,
        sla_ledgers: 1_000,
        paid: false,
    };

    let err = t
        .client()
        .try_create_escrow(
            &t.ref_code,
            &t.importer,
            &t.exporter,
            &ESCROW_AMOUNT,
            &t.default_milestones(),
            &8_000u32,
            &vec![&t.env, bad_bonus],
            &t.importer,
            &0i128,
        )
        .unwrap_err()
        .unwrap();

    assert_eq!(err, EscrowError::InvalidBonusParams);
}

// ── 2. Fund ───────────────────────────────────────────────────────────────────

#[test]
fn test_fund_transfers_usdc_to_contract() {
    let t = TestEnv::setup();
    let client = t.client();

    t.create_escrow_basic();

    let token = TokenClient::new(&t.env, &t.usdc);
    let before = token.balance(&t.importer);

    client.fund(&t.ref_code, &t.importer);

    let after = token.balance(&t.importer);
    assert_eq!(before - after, ESCROW_AMOUNT);
    assert_eq!(token.balance(&t.contract_address), ESCROW_AMOUNT);

    let record = client.get_escrow(&t.ref_code);
    assert_eq!(record.status, EscrowStatus::Funded);
    assert_eq!(record.cancellation_stage, CancellationStage::PreDeparture);
}

#[test]
fn test_fund_twice_rejected() {
    let t = TestEnv::setup();
    t.create_and_fund();

    let err = t
        .client()
        .try_fund(&t.ref_code, &t.importer)
        .unwrap_err()
        .unwrap();

    assert_eq!(err, EscrowError::AlreadyFunded);
}

// ── 3. Milestone confirmation ─────────────────────────────────────────────────

#[test]
fn test_confirm_milestone_success() {
    let t = TestEnv::setup();
    t.create_and_fund();
    let client = t.client();

    client.confirm_milestone(
        &t.ref_code,
        &t.logistics_user,
        &MilestoneType::VesselDepartedOrigin,
        &t.evidence_uri(),
    );

    let pending = client.get_pending_milestones(&t.ref_code);
    assert_eq!(pending.len(), 2); // 3 required - 1 confirmed = 2 pending

    let confirmed = client.get_confirmed_milestones(&t.ref_code);
    assert_eq!(confirmed.len(), 1);
    assert_eq!(
        confirmed.get(0).unwrap().milestone_type,
        MilestoneType::VesselDepartedOrigin
    );
}

#[test]
fn test_confirm_milestone_missing_evidence_rejected() {
    let t = TestEnv::setup();
    t.create_and_fund();

    let empty_uri = String::from_str(&t.env, "");
    let err = t
        .client()
        .try_confirm_milestone(
            &t.ref_code,
            &t.logistics_user,
            &MilestoneType::VesselDepartedOrigin,
            &empty_uri,
        )
        .unwrap_err()
        .unwrap();

    assert_eq!(err, EscrowError::MissingEvidence);
}

#[test]
fn test_confirm_milestone_duplicate_rejected() {
    let t = TestEnv::setup();
    t.create_and_fund();
    let client = t.client();

    client.confirm_milestone(
        &t.ref_code,
        &t.logistics_user,
        &MilestoneType::VesselDepartedOrigin,
        &t.evidence_uri(),
    );

    let err = client
        .try_confirm_milestone(
            &t.ref_code,
            &t.logistics_user,
            &MilestoneType::VesselDepartedOrigin,
            &t.evidence_uri(),
        )
        .unwrap_err()
        .unwrap();

    assert_eq!(err, EscrowError::MilestoneAlreadyConfirmed);
}

#[test]
fn test_confirm_milestone_unauthorized_user_rejected() {
    let t = TestEnv::setup();
    t.create_and_fund();

    let rando = Address::generate(&t.env);
    let err = t
        .client()
        .try_confirm_milestone(
            &t.ref_code,
            &rando,
            &MilestoneType::VesselDepartedOrigin,
            &t.evidence_uri(),
        )
        .unwrap_err()
        .unwrap();

    assert_eq!(err, EscrowError::NotAuthorizedLogisticsUser);
}

#[test]
fn test_confirm_milestone_not_required_rejected() {
    let t = TestEnv::setup();
    t.create_and_fund();

    // BookingConfirmed is NOT in the default required list.
    let err = t
        .client()
        .try_confirm_milestone(
            &t.ref_code,
            &t.logistics_user,
            &MilestoneType::BookingConfirmed,
            &t.evidence_uri(),
        )
        .unwrap_err()
        .unwrap();

    assert_eq!(err, EscrowError::MilestoneNotRequired);
}

// ── 4. Release ────────────────────────────────────────────────────────────────

#[test]
fn test_release_success_after_all_milestones() {
    let t = TestEnv::setup();
    t.create_and_fund();
    let client = t.client();

    // Confirm all 3 required milestones.
    for m in [
        MilestoneType::VesselDepartedOrigin,
        MilestoneType::CustomsClearanceApproved,
        MilestoneType::DeliveredAndSignedOff,
    ] {
        client.confirm_milestone(&t.ref_code, &t.logistics_user, &m, &t.evidence_uri());
    }

    assert_eq!(client.can_release(&t.ref_code), true);

    let token = TokenClient::new(&t.env, &t.usdc);
    let exporter_before = token.balance(&t.exporter);

    client.release(&t.ref_code, &t.importer);

    // Exporter received full ESCROW_AMOUNT.
    assert_eq!(token.balance(&t.exporter) - exporter_before, ESCROW_AMOUNT);
    // Contract vault is now empty.
    assert_eq!(token.balance(&t.contract_address), 0);

    let record = client.get_escrow(&t.ref_code);
    assert_eq!(record.status, EscrowStatus::Released);
}

#[test]
fn test_release_blocked_when_milestones_incomplete() {
    let t = TestEnv::setup();
    t.create_and_fund();
    let client = t.client();

    // Only confirm 2 out of 3.
    for m in [
        MilestoneType::VesselDepartedOrigin,
        MilestoneType::CustomsClearanceApproved,
    ] {
        client.confirm_milestone(&t.ref_code, &t.logistics_user, &m, &t.evidence_uri());
    }

    assert_eq!(client.can_release(&t.ref_code), false);

    let err = client
        .try_release(&t.ref_code, &t.importer)
        .unwrap_err()
        .unwrap();

    assert_eq!(err, EscrowError::PriorityMilestonesIncomplete);
}

// ── 5. Cancellation — UNFUNDED ────────────────────────────────────────────────

#[test]
fn test_cancel_unfunded_no_transfer_needed() {
    let t = TestEnv::setup();
    let client = t.client();

    t.create_escrow_basic();

    // No USDC was deposited, cancellation should succeed without any transfer.
    client.cancel(&t.ref_code, &t.importer, &t.platform);

    let record = client.get_escrow(&t.ref_code);
    assert_eq!(record.status, EscrowStatus::Refunded);
}

// ── 6. Cancellation — PRE_DEPARTURE ──────────────────────────────────────────

#[test]
fn test_cancel_pre_departure_partial_refund() {
    let t = TestEnv::setup();
    t.create_and_fund(); // partial_refund_bps = 8_000 (80%)
    let client = t.client();

    let token = TokenClient::new(&t.env, &t.usdc);
    let importer_before = token.balance(&t.importer);
    let platform_before = token.balance(&t.platform);

    client.cancel(&t.ref_code, &t.importer, &t.platform);

    let importer_refund = token.balance(&t.importer) - importer_before;
    let platform_fee = token.balance(&t.platform) - platform_before;

    // 80% refund = 8_000 USDC, 20% platform = 2_000 USDC.
    assert_eq!(importer_refund, 8_000 * 10_000_000_i128);
    assert_eq!(platform_fee, 2_000 * 10_000_000_i128);
    assert_eq!(token.balance(&t.contract_address), 0);

    let record = client.get_escrow(&t.ref_code);
    assert_eq!(record.status, EscrowStatus::Refunded);
}

// ── 7. Dispute flow ───────────────────────────────────────────────────────────

#[test]
fn test_in_transit_cancel_requires_raise_dispute_first() {
    let t = TestEnv::setup();
    t.create_and_fund();
    let client = t.client();

    // Advance to IN_TRANSIT.
    client.advance_stage(&t.ref_code, &t.platform, &CancellationStage::InTransit);

    // Direct cancel should fail with RequiresPlatformArbitration.
    let err = client
        .try_cancel(&t.ref_code, &t.importer, &t.platform)
        .unwrap_err()
        .unwrap();

    assert_eq!(err, EscrowError::RequiresPlatformArbitration);
}

#[test]
fn test_raise_dispute_then_resolve() {
    let t = TestEnv::setup();
    t.create_and_fund();
    let client = t.client();

    client.advance_stage(&t.ref_code, &t.platform, &CancellationStage::InTransit);
    client.raise_dispute(&t.ref_code, &t.importer);

    let record = client.get_escrow(&t.ref_code);
    assert_eq!(record.status, EscrowStatus::Disputed);

    let token = TokenClient::new(&t.env, &t.usdc);
    let importer_before = token.balance(&t.importer);
    let exporter_before = token.balance(&t.exporter);

    // Platform splits: 60% importer, 40% exporter.
    client.resolve_dispute(&t.ref_code, &t.platform, &6_000u32, &4_000u32);

    assert_eq!(
        token.balance(&t.importer) - importer_before,
        6_000 * 10_000_000_i128
    );
    assert_eq!(
        token.balance(&t.exporter) - exporter_before,
        4_000 * 10_000_000_i128
    );
    assert_eq!(token.balance(&t.contract_address), 0);
}

// ── 8. DELIVERED stage blocks cancellation ────────────────────────────────────

#[test]
fn test_cancel_after_delivered_rejected() {
    let t = TestEnv::setup();
    t.create_and_fund();
    let client = t.client();

    client.advance_stage(&t.ref_code, &t.platform, &CancellationStage::Delivered);

    let err = client
        .try_cancel(&t.ref_code, &t.importer, &t.platform)
        .unwrap_err()
        .unwrap();

    assert_eq!(err, EscrowError::CancellationNotAllowed);
}

// ── 9. Double-settle guard ────────────────────────────────────────────────────

#[test]
fn test_release_after_already_released_rejected() {
    let t = TestEnv::setup();
    t.create_and_fund();
    let client = t.client();

    for m in [
        MilestoneType::VesselDepartedOrigin,
        MilestoneType::CustomsClearanceApproved,
        MilestoneType::DeliveredAndSignedOff,
    ] {
        client.confirm_milestone(&t.ref_code, &t.logistics_user, &m, &t.evidence_uri());
    }

    client.release(&t.ref_code, &t.importer);

    let err = client
        .try_release(&t.ref_code, &t.importer)
        .unwrap_err()
        .unwrap();

    assert_eq!(err, EscrowError::NotFunded);
}

// ── 10. Stage advance is idempotent ───────────────────────────────────────────

#[test]
fn test_advance_stage_idempotent() {
    let t = TestEnv::setup();
    t.create_and_fund();
    let client = t.client();

    client.advance_stage(&t.ref_code, &t.platform, &CancellationStage::InTransit);

    // Advancing to the same or earlier stage is a no-op, not an error.
    client.advance_stage(&t.ref_code, &t.platform, &CancellationStage::PreDeparture);

    let record = client.get_escrow(&t.ref_code);
    assert_eq!(record.cancellation_stage, CancellationStage::InTransit);
}

// ── 11. Escrow-as-incentive: milestone speed bonus (Phase 5) ─────────────────

#[test]
fn test_milestone_bonus_paid_within_sla() {
    let t = TestEnv::setup();
    let client = t.client();

    let bonus_amount = 200 * 10_000_000_i128; // 200 USDC
    let bonus = MilestoneBonus {
        milestone_type: MilestoneType::VesselDepartedOrigin,
        bonus_amount,
        sla_ledgers: 1_000,
        paid: false, // ignored by the contract; always stored as false
    };

    client.create_escrow(
        &t.ref_code,
        &t.importer,
        &t.exporter,
        &ESCROW_AMOUNT,
        &t.default_milestones(),
        &8_000u32,
        &vec![&t.env, bonus],
        &t.importer,
        &0i128,
    );

    client.assign_logistics_users(
        &t.ref_code,
        &t.importer,
        &vec![&t.env, t.logistics_user.clone()],
    );

    let token = TokenClient::new(&t.env, &t.usdc);
    let importer_before = token.balance(&t.importer);

    // fund() should pull amount + bonus reserve in a single transfer.
    client.fund(&t.ref_code, &t.importer);
    assert_eq!(
        importer_before - token.balance(&t.importer),
        ESCROW_AMOUNT + bonus_amount
    );

    let logistics_before = token.balance(&t.logistics_user);

    // Confirm well within the 1_000-ledger SLA window.
    client.confirm_milestone(
        &t.ref_code,
        &t.logistics_user,
        &MilestoneType::VesselDepartedOrigin,
        &t.evidence_uri(),
    );

    // Bonus paid immediately to the confirming logistics user.
    assert_eq!(
        token.balance(&t.logistics_user) - logistics_before,
        bonus_amount
    );

    let record = client.get_escrow(&t.ref_code);
    assert_eq!(record.bonus_reserve_remaining, 0);
    assert_eq!(record.milestone_bonuses.get(0).unwrap().paid, true);
}

#[test]
fn test_milestone_bonus_missed_sla_not_paid_and_refunded_at_release() {
    let t = TestEnv::setup();
    let client = t.client();

    let bonus_amount = 200 * 10_000_000_i128;
    let bonus = MilestoneBonus {
        milestone_type: MilestoneType::VesselDepartedOrigin,
        bonus_amount,
        sla_ledgers: 5, // very tight SLA window
        paid: false,
    };

    client.create_escrow(
        &t.ref_code,
        &t.importer,
        &t.exporter,
        &ESCROW_AMOUNT,
        &t.default_milestones(),
        &8_000u32,
        &vec![&t.env, bonus],
        &t.importer,
        &0i128,
    );

    client.assign_logistics_users(
        &t.ref_code,
        &t.importer,
        &vec![&t.env, t.logistics_user.clone()],
    );

    client.fund(&t.ref_code, &t.importer);

    // Advance the ledger well past the SLA window before confirming.
    t.env.ledger().with_mut(|l| l.sequence_number += 1_000);

    let token = TokenClient::new(&t.env, &t.usdc);
    let logistics_before = token.balance(&t.logistics_user);

    client.confirm_milestone(
        &t.ref_code,
        &t.logistics_user,
        &MilestoneType::VesselDepartedOrigin,
        &t.evidence_uri(),
    );

    // SLA missed — no bonus paid to the logistics user.
    assert_eq!(token.balance(&t.logistics_user), logistics_before);

    let record_after_confirm = client.get_escrow(&t.ref_code);
    assert_eq!(record_after_confirm.bonus_reserve_remaining, bonus_amount);
    assert_eq!(
        record_after_confirm.milestone_bonuses.get(0).unwrap().paid,
        false
    );

    // Confirm the remaining required milestones to unlock release.
    client.confirm_milestone(
        &t.ref_code,
        &t.logistics_user,
        &MilestoneType::CustomsClearanceApproved,
        &t.evidence_uri(),
    );
    client.confirm_milestone(
        &t.ref_code,
        &t.logistics_user,
        &MilestoneType::DeliveredAndSignedOff,
        &t.evidence_uri(),
    );

    let importer_before_release = token.balance(&t.importer);
    client.release(&t.ref_code, &t.importer);

    // Unclaimed bonus reserve is returned to the importer at release.
    assert_eq!(
        token.balance(&t.importer) - importer_before_release,
        bonus_amount
    );

    let record = client.get_escrow(&t.ref_code);
    assert_eq!(record.bonus_reserve_remaining, 0);
}

// ── 12. Escrow-as-incentive: performance bond (Phase 5) ───────────────────────

#[test]
fn test_performance_bond_stake_and_redeem_on_release() {
    let t = TestEnv::setup();
    let client = t.client();

    let bond_amount = 1_000 * 10_000_000_i128; // 1_000 USDC

    client.create_escrow(
        &t.ref_code,
        &t.importer,
        &t.exporter,
        &ESCROW_AMOUNT,
        &t.default_milestones(),
        &8_000u32,
        &t.no_bonuses(),
        &t.logistics_user,
        &bond_amount,
    );

    client.assign_logistics_users(
        &t.ref_code,
        &t.importer,
        &vec![&t.env, t.logistics_user.clone()],
    );

    let token = TokenClient::new(&t.env, &t.usdc);
    let logistics_before = token.balance(&t.logistics_user);

    client.stake_performance_bond(&t.ref_code, &t.logistics_user);

    assert_eq!(logistics_before - token.balance(&t.logistics_user), bond_amount);
    assert_eq!(token.balance(&t.contract_address), bond_amount);

    client.fund(&t.ref_code, &t.importer);

    for m in [
        MilestoneType::VesselDepartedOrigin,
        MilestoneType::CustomsClearanceApproved,
        MilestoneType::DeliveredAndSignedOff,
    ] {
        client.confirm_milestone(&t.ref_code, &t.logistics_user, &m, &t.evidence_uri());
    }

    let logistics_before_release = token.balance(&t.logistics_user);
    client.release(&t.ref_code, &t.importer);

    // Bond redeemed back to the logistics user on clean delivery.
    assert_eq!(
        token.balance(&t.logistics_user) - logistics_before_release,
        bond_amount
    );

    let record = client.get_escrow(&t.ref_code);
    assert_eq!(record.performance_bond.staked, true);
    assert_eq!(record.performance_bond.resolved, true);
}

#[test]
fn test_performance_bond_wrong_staker_rejected() {
    let t = TestEnv::setup();
    let client = t.client();

    let bond_amount = 1_000 * 10_000_000_i128;

    client.create_escrow(
        &t.ref_code,
        &t.importer,
        &t.exporter,
        &ESCROW_AMOUNT,
        &t.default_milestones(),
        &8_000u32,
        &t.no_bonuses(),
        &t.logistics_user,
        &bond_amount,
    );

    let rando = Address::generate(&t.env);
    let err = client
        .try_stake_performance_bond(&t.ref_code, &rando)
        .unwrap_err()
        .unwrap();

    assert_eq!(err, EscrowError::NotBondLogisticsUser);
}

#[test]
fn test_performance_bond_forfeit_on_dispute() {
    let t = TestEnv::setup();
    let client = t.client();

    let bond_amount = 1_000 * 10_000_000_i128;

    client.create_escrow(
        &t.ref_code,
        &t.importer,
        &t.exporter,
        &ESCROW_AMOUNT,
        &t.default_milestones(),
        &8_000u32,
        &t.no_bonuses(),
        &t.logistics_user,
        &bond_amount,
    );

    client.assign_logistics_users(
        &t.ref_code,
        &t.importer,
        &vec![&t.env, t.logistics_user.clone()],
    );

    client.stake_performance_bond(&t.ref_code, &t.logistics_user);
    client.fund(&t.ref_code, &t.importer);

    client.advance_stage(&t.ref_code, &t.platform, &CancellationStage::InTransit);
    client.raise_dispute(&t.ref_code, &t.importer);

    let token = TokenClient::new(&t.env, &t.usdc);
    let importer_before = token.balance(&t.importer);

    // Platform confirms damage and forfeits the bond to the importer
    // BEFORE resolving the dispute.
    client.forfeit_bond(&t.ref_code, &t.platform);

    assert_eq!(token.balance(&t.importer) - importer_before, bond_amount);

    let record = client.get_escrow(&t.ref_code);
    assert_eq!(record.performance_bond.resolved, true);

    // Calling forfeit_bond again should fail — already resolved.
    let err = client
        .try_forfeit_bond(&t.ref_code, &t.platform)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, EscrowError::BondNotStaked);

    // Resolving the dispute afterward must NOT re-pay the (already-forfeited) bond.
    let logistics_before = token.balance(&t.logistics_user);
    client.resolve_dispute(&t.ref_code, &t.platform, &6_000u32, &4_000u32);
    assert_eq!(token.balance(&t.logistics_user), logistics_before);
}

#[test]
fn test_performance_bond_redeemed_by_default_if_not_forfeited() {
    let t = TestEnv::setup();
    let client = t.client();

    let bond_amount = 1_000 * 10_000_000_i128;

    client.create_escrow(
        &t.ref_code,
        &t.importer,
        &t.exporter,
        &ESCROW_AMOUNT,
        &t.default_milestones(),
        &8_000u32,
        &t.no_bonuses(),
        &t.logistics_user,
        &bond_amount,
    );

    client.assign_logistics_users(
        &t.ref_code,
        &t.importer,
        &vec![&t.env, t.logistics_user.clone()],
    );

    client.stake_performance_bond(&t.ref_code, &t.logistics_user);
    client.fund(&t.ref_code, &t.importer);

    client.advance_stage(&t.ref_code, &t.platform, &CancellationStage::InTransit);
    client.raise_dispute(&t.ref_code, &t.importer);

    let token = TokenClient::new(&t.env, &t.usdc);
    let logistics_before = token.balance(&t.logistics_user);

    // Platform resolves without ever calling forfeit_bond — bond is redeemed
    // back to the logistics user by default (no fault established).
    client.resolve_dispute(&t.ref_code, &t.platform, &6_000u32, &4_000u32);

    assert_eq!(token.balance(&t.logistics_user) - logistics_before, bond_amount);

    let record = client.get_escrow(&t.ref_code);
    assert_eq!(record.performance_bond.resolved, true);
}
