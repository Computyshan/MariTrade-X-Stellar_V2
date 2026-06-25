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
    testutils::Address as _,
    token::{Client as TokenClient, StellarAssetClient},
    vec, Address, Env, String,
};

use crate::{
    errors::EscrowError,
    types::{CancellationStage, EscrowStatus, MilestoneType},
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

        // Mint USDC to the importer.
        let importer = Address::generate(&env);
        StellarAssetClient::new(&env, &usdc_address).mint(&importer, &(ESCROW_AMOUNT * 10));

        let platform = Address::generate(&env);
        let exporter = Address::generate(&env);
        let logistics_user = Address::generate(&env);

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

    /// Create + fund an escrow and assign logistics users — shortcut for tests
    /// that want to start from the FUNDED state.
    fn create_and_fund(&self) {
        let client = self.client();

        client.create_escrow(
            &self.ref_code,
            &self.importer,
            &self.exporter,
            &ESCROW_AMOUNT,
            &self.default_milestones(),
            &8_000u32, // 80% refund if pre-departure cancel
        );

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
    let client = t.client();

    client.create_escrow(
        &t.ref_code,
        &t.importer,
        &t.exporter,
        &ESCROW_AMOUNT,
        &t.default_milestones(),
        &8_000u32,
    );

    let record = client.get_escrow(&t.ref_code);
    assert_eq!(record.status, EscrowStatus::Unfunded);
    assert_eq!(record.importer, t.importer);
    assert_eq!(record.exporter, t.exporter);
    assert_eq!(record.amount, ESCROW_AMOUNT);
    assert_eq!(record.partial_refund_bps, 8_000u32);
    assert_eq!(record.required_milestones.len(), 3);
}

#[test]
fn test_create_escrow_duplicate_rejected() {
    let t = TestEnv::setup();
    let client = t.client();

    client.create_escrow(
        &t.ref_code,
        &t.importer,
        &t.exporter,
        &ESCROW_AMOUNT,
        &t.default_milestones(),
        &8_000u32,
    );

    // Same ref code → AlreadyInitialized.
    let err = client
        .try_create_escrow(
            &t.ref_code,
            &t.importer,
            &t.exporter,
            &ESCROW_AMOUNT,
            &t.default_milestones(),
            &8_000u32,
        )
        .unwrap_err()
        .unwrap();

    assert_eq!(err, EscrowError::AlreadyInitialized);
}

#[test]
fn test_create_escrow_invalid_bps_rejected() {
    let t = TestEnv::setup();
    let client = t.client();

    // 10_001 bps > 10_000 → InvalidBps.
    let err = client
        .try_create_escrow(
            &t.ref_code,
            &t.importer,
            &t.exporter,
            &ESCROW_AMOUNT,
            &t.default_milestones(),
            &10_001u32,
        )
        .unwrap_err()
        .unwrap();

    assert_eq!(err, EscrowError::InvalidBps);
}

// ── 2. Fund ───────────────────────────────────────────────────────────────────

#[test]
fn test_fund_transfers_usdc_to_contract() {
    let t = TestEnv::setup();
    let client = t.client();

    client.create_escrow(
        &t.ref_code,
        &t.importer,
        &t.exporter,
        &ESCROW_AMOUNT,
        &t.default_milestones(),
        &8_000u32,
    );

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

    client.create_escrow(
        &t.ref_code,
        &t.importer,
        &t.exporter,
        &ESCROW_AMOUNT,
        &t.default_milestones(),
        &8_000u32,
    );

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
