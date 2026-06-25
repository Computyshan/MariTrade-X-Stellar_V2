//! Storage layer for the MariTrade escrow contract.
//!
//! ## Storage Strategy
//!
//! | Data              | Storage Type | Rationale                                  |
//! |-------------------|--------------|--------------------------------------------|
//! | EscrowRecord      | Persistent   | Long-lived shipment state; must survive TTL |
//! | Logistics users   | Persistent   | Active during entire shipment lifecycle     |
//! | Platform address  | Instance     | Global config, shared, never changes        |
//!
//! TTL targets:
//!   MIN_TTL  = 17_280 ledgers ≈ 1 day  (extend when below this)
//!   BUMP_TO  = 535_680 ledgers ≈ 31 days

#![no_std]

use soroban_sdk::{contracttype, Address, Env, Vec};

use crate::errors::EscrowError;
use crate::types::EscrowRecord;

// ─── TTL constants ─────────────────────────────────────────────────────────────

/// Minimum TTL before we extend (≈ 1 day at 5s per ledger).
pub const MIN_TTL: u32 = 17_280;
/// Target TTL after extension (≈ 31 days at 5s per ledger).
pub const BUMP_TO: u32 = 535_680;

// ─── Storage Keys ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    /// Instance storage: MariTrade platform address (global, single value).
    Platform,
    /// Instance storage: USDC SAC token address (set at deploy time).
    UsdcToken,
    /// Persistent storage: full escrow record, keyed by shipment reference code.
    Escrow(soroban_sdk::String),
    /// Persistent storage: set of Stellar addresses authorized as logistics users
    /// for a given shipment reference code.
    LogisticsUsers(soroban_sdk::String),
}

// ─── Platform / Config ─────────────────────────────────────────────────────────

/// Write the MariTrade platform address to instance storage.
/// Called once during `__constructor`.
pub fn set_platform(env: &Env, platform: &Address) {
    env.storage().instance().set(&DataKey::Platform, platform);
}

/// Read the MariTrade platform address from instance storage.
pub fn get_platform(env: &Env) -> Result<Address, EscrowError> {
    env.storage()
        .instance()
        .get(&DataKey::Platform)
        .ok_or(EscrowError::NotFound)
}

/// Write the USDC SAC token address to instance storage.
pub fn set_usdc_token(env: &Env, usdc_token: &Address) {
    env.storage().instance().set(&DataKey::UsdcToken, usdc_token);
}

/// Read the USDC SAC token address from instance storage.
pub fn get_usdc_token(env: &Env) -> Result<Address, EscrowError> {
    env.storage()
        .instance()
        .get(&DataKey::UsdcToken)
        .ok_or(EscrowError::NotFound)
}

// ─── Escrow Record ─────────────────────────────────────────────────────────────

/// Write (or overwrite) an EscrowRecord to persistent storage.
/// Also bumps the TTL to avoid archival.
pub fn set_escrow(env: &Env, reference_code: &soroban_sdk::String, record: &EscrowRecord) {
    let key = DataKey::Escrow(reference_code.clone());
    env.storage().persistent().set(&key, record);
    env.storage()
        .persistent()
        .extend_ttl(&key, MIN_TTL, BUMP_TO);
}

/// Read an EscrowRecord from persistent storage.
pub fn get_escrow(
    env: &Env,
    reference_code: &soroban_sdk::String,
) -> Result<EscrowRecord, EscrowError> {
    let key = DataKey::Escrow(reference_code.clone());
    let record: EscrowRecord = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(EscrowError::NotFound)?;

    // Refresh TTL on every read so active shipments never expire.
    env.storage()
        .persistent()
        .extend_ttl(&key, MIN_TTL, BUMP_TO);

    Ok(record)
}

/// Check whether an escrow record exists for a given reference code.
pub fn escrow_exists(env: &Env, reference_code: &soroban_sdk::String) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Escrow(reference_code.clone()))
}

// ─── Logistics Users ───────────────────────────────────────────────────────────

/// Write the full logistics user list for a shipment.
/// Overwrites any existing list.
pub fn set_logistics_users(
    env: &Env,
    reference_code: &soroban_sdk::String,
    users: &Vec<Address>,
) {
    let key = DataKey::LogisticsUsers(reference_code.clone());
    env.storage().persistent().set(&key, users);
    env.storage()
        .persistent()
        .extend_ttl(&key, MIN_TTL, BUMP_TO);
}

/// Read the logistics user list for a shipment.
/// Returns an empty Vec if none have been assigned yet.
pub fn get_logistics_users(env: &Env, reference_code: &soroban_sdk::String) -> Vec<Address> {
    let key = DataKey::LogisticsUsers(reference_code.clone());
    let users: Vec<Address> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| soroban_sdk::vec![env]);

    // Refresh TTL on access.
    if env.storage().persistent().has(&key) {
        env.storage()
            .persistent()
            .extend_ttl(&key, MIN_TTL, BUMP_TO);
    }

    users
}

/// Check if an address is in the logistics user list for a shipment.
pub fn is_logistics_user(
    env: &Env,
    reference_code: &soroban_sdk::String,
    candidate: &Address,
) -> bool {
    let users = get_logistics_users(env, reference_code);
    users.contains(candidate)
}
