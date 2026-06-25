//! MariTrade Escrow Contract
//!
//! A Soroban smart contract for MariTrade's shipment payment escrow system.
//! Funds (USDC) are locked at shipment creation and released only when all
//! importer-selected priority milestones are confirmed by the logistics chain.
//!
//! # Parties
//! - Importer  (buyer)  — funds the escrow, selects priority milestones, approves release
//! - Exporter  (seller) — receives funds on release
//! - Platform  (MariTrade) — co-signs critical operations for dispute / arbitration
//!
//! # Lifecycle
//! ```
//! deploy ──► fund ──► milestone confirmations ──► release
//!                           │
//!                           └─► cancel (stage-dependent refund policy)
//! ```

#![no_std]

mod escrow;
mod errors;
mod events;
mod storage;
mod types;

pub use escrow::MariTradeEscrowContract;

// The `contractimpl` macro generates `MariTradeEscrowContractClient` inside
// the `escrow` module. Re-export it at crate root so tests can import it via
// `crate::MariTradeEscrowContractClient`.
#[cfg(test)]
pub use escrow::MariTradeEscrowContractClient;

#[cfg(test)]
mod tests;
