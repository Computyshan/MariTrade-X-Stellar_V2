# MariTrade Escrow Contract

Soroban smart contract that powers MariTrade's shipment payment escrow system.
USDC is locked at shipment creation and released only when all importer-selected
priority milestones are confirmed by the logistics chain.

---

## Architecture

```
Importer
  │  create_escrow()   ← registers vault, selects milestones, configures
  │                       optional Phase 5 milestone bonuses + bond requirement
  │  fund()            ← deposits USDC via SAC transfer (base amount + bonus reserve)
  │  release()         ← sends USDC to exporter (after all milestones); returns
  │                       unclaimed bonus reserve + redeems any staked bond
  │  cancel()          ← refund per stage policy (+ bonus/bond reversal)
  │  raise_dispute()   ← IN_TRANSIT → platform arbitration
  ▼
[MariTrade Escrow Contract]
  │
  ├── Logistics Users
  │     confirm_milestone()       ← with evidence URI (IPFS / HTTPS); pays a
  │                                  speed bonus immediately if within SLA
  │     stake_performance_bond()  ← deposit required bond (Phase 5, if any)
  │
  └── MariTrade Platform
        advance_stage()      ← PRE_DEPARTURE → IN_TRANSIT → DELIVERED
        cancel()             ← co-sign for PRE_DEPARTURE refunds
        resolve_dispute()    ← split funds in arbitration
        forfeit_bond()       ← forfeit a staked bond to importer (call BEFORE
                                resolve_dispute; otherwise the bond redeems to
                                the logistics user by default)
```

---

## Escrow-as-Incentive (Phase 5)

Two optional incentive mechanisms, configured at `create_escrow` time:

### Milestone speed bonuses

`milestone_bonuses: Vec<MilestoneBonus>` — each entry ties a bonus USDC amount
to one of the escrow's `required_milestones`, with an SLA window (in ledgers)
measured from `funded_at_ledger`. The total bonus reserve is pulled into the
vault alongside the base `amount` at `fund()` time. When a logistics user
confirms a bonused milestone within its SLA window, the bonus is paid to them
immediately in `confirm_milestone`. Any bonus reserve left unclaimed (missed
SLA windows) is returned to the importer when the escrow is finally settled
(`release`, `cancel`, or `resolve_dispute`).

Pass an empty `Vec` for no bonuses.

### Performance bond

`bond_logistics_user` + `bond_amount` — requires the named logistics user to
stake a USDC bond via `stake_performance_bond` before (or any time before)
release. `bond_amount == 0` means no bond is required, and all bond
entrypoints reject with `BondNotRequired` / are simply not needed.

| Outcome                          | Trigger                                             | Bond goes to     |
|-----------------------------------|------------------------------------------------------|------------------|
| Redeemed (clean delivery)         | `release()` succeeds                                 | Logistics user   |
| Redeemed (neutral cancellation)   | `cancel()` in PRE_DEPARTURE stage                     | Logistics user   |
| Redeemed (no fault found)         | `resolve_dispute()` without a prior `forfeit_bond()`  | Logistics user   |
| Forfeited (confirmed fault)       | Platform calls `forfeit_bond()` while `Disputed`      | Importer         |

`forfeit_bond` must be called **before** `resolve_dispute` — once
`resolve_dispute` runs the escrow leaves the `Disputed` status.

---

## Cancellation Policy

| Stage          | Allowed? | Who signs              | Refund to importer              |
|----------------|----------|------------------------|---------------------------------|
| `UNFUNDED`     | ✅ Yes   | Importer only          | Full (no USDC transferred yet)  |
| `PRE_DEPARTURE`| ✅ Yes   | Importer + Platform    | `partial_refund_bps` of total   |
| `IN_TRANSIT`   | ⚠️ Via dispute | Importer → Platform | Platform arbitration split  |
| `DELIVERED`    | ❌ No    | —                      | None                            |

---

## File Structure

```
contracts/escrow/
├── Cargo.toml                   Rust workspace manifest
└── src/
    ├── lib.rs                   Crate root — module declarations
    ├── escrow.rs                Core contract implementation
    ├── types.rs                 On-chain domain types (EscrowRecord, etc.)
    ├── errors.rs                Contract error codes
    ├── events.rs                On-chain events (indexed by Stellar RPC)
    ├── storage.rs               Persistent / instance storage helpers + TTL
    └── tests.rs                 Integration tests (10 scenarios)

lib/stellar/
└── escrow-contract.ts           TypeScript SDK integration (Next.js)
```

---

## Setup & Build

### Prerequisites

```bash
# Install Rust + wasm32 target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install Stellar CLI (v22+)
cargo install --locked stellar-cli --features opt
```

### Build

```bash
cd contracts/escrow

# Debug build
cargo build --target wasm32-unknown-unknown

# Optimised release build (required for deployment)
cargo build --release --target wasm32v1-none
```

### Test

```bash
cd contracts/escrow
cargo test
```

---

## Deploy

### 1. Deploy to Testnet

```bash
stellar contract deploy \
  --wasm contracts/escrow/target/wasm32v1-none/release/maritrade_escrow.wasm \
  --source-account YOUR_PLATFORM_SECRET_KEY \
  --network testnet \
  -- \
  --platform GPLATFORM_ADDRESS \
  --usdc_token CUSDC_SAC_ADDRESS_TESTNET
```

The `--` separator passes constructor arguments to `__constructor`.

### 2. Save the contract ID

Add the returned contract ID to `.env.local`:

```env
NEXT_PUBLIC_ESCROW_CONTRACT_ID_TESTNET=CXXX...
NEXT_PUBLIC_USDC_SAC_TESTNET=CYYY...
```

### 3. Testnet USDC SAC address

Stellar USDC on testnet (Circle):
```
GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
```
Wrap it as a SAC:
```bash
stellar contract asset deploy \
  --asset USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 \
  --network testnet \
  --source-account YOUR_SECRET_KEY
```

---

## TypeScript Integration

`lib/stellar/escrow-contract.ts` is the SDK integration layer for the Next.js
project. It replaces the existing `lib/stellar/escrow.ts` stub.

### Create escrow (NewShipmentPage Step 4)

```typescript
import { getMariTradeEscrowClient, MilestoneType } from "@/lib/stellar/escrow-contract";

const client = getMariTradeEscrowClient("testnet", walletPublicKey);

// 1. Build + simulate the transaction
const xdrEnvelope = await client.createEscrow({
  referenceCode: shipment.referenceCode,   // "MT-2026-00001"
  importer: walletPublicKey,
  exporter: shipment.exporter.stellarAddress,
  amountUsd: shipment.totalValueUSD,
  requiredMilestones: [
    MilestoneType.VesselDepartedOrigin,
    MilestoneType.CustomsClearanceApproved,
    MilestoneType.DeliveredAndSignedOff,
  ],
  partialRefundPercent: 80,               // 80% refund if pre-departure cancel
  milestoneBonuses: [                     // optional (Phase 5)
    {
      milestoneType: MilestoneType.VesselDepartedOrigin,
      bonusAmountUsd: 200,                // paid to the confirming logistics user
      slaLedgers: 17_280,                 // ≈ 1 day at 5s/ledger
    },
  ],
  bondLogisticsUser: logisticsUserWallet, // optional (Phase 5); omit for no bond
  bondAmountUsd: 1_000,                   // 0 / omitted means no bond required
});

// 2. Sign via Freighter / Stellar Wallets Kit
const signedXdr = await freighter.signTransaction(xdrEnvelope, {
  network: "TESTNET",
});

// 3. Submit
const server = new Server("https://soroban-testnet.stellar.org");
await server.sendTransaction(TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET));
```

### Confirm a milestone (Logistics user)

```typescript
const xdrEnvelope = await client.confirmMilestone({
  referenceCode: "MT-2026-00001",
  confirmer: logisticsUserWallet,
  milestoneType: MilestoneType.VesselDepartedOrigin,
  evidenceUri: "ipfs://QmUploadedBillOfLadingHash",
});
```

### Release funds (Importer, after all milestones)

```typescript
const ready = await client.canRelease("MT-2026-00001");
if (ready) {
  const xdrEnvelope = await client.release({
    referenceCode: "MT-2026-00001",
    importer: walletPublicKey,
  });
  // sign + submit ...
}
```

---

## On-chain Events

The contract emits indexed events on every state change.
Subscribe in the Next.js backend via Stellar RPC event streaming:

```typescript
const rpc = new Server("https://soroban-testnet.stellar.org");

const events = await rpc.getEvents({
  startLedger: fromLedger,
  filters: [
    {
      type: "contract",
      contractIds: [process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID_TESTNET!],
      topics: [["escrow", "milestone"]],   // only milestone events
    },
  ],
});
```

| Event symbol | Emitted when                                   |
|--------------|------------------------------------------------|
| `init`       | Escrow vault created                           |
| `funded`     | USDC deposited by importer                     |
| `milestone`  | Milestone confirmed with evidence URI          |
| `released`   | Funds released to exporter                     |
| `cancelled`  | Refund issued (with amounts)                   |
| `disputed`   | Dispute raised by importer                     |
| `resolved`   | Platform resolved dispute                      |
| `status`     | Any status change (general state machine hook) |
| `bonuspaid`  | Milestone speed bonus paid to logistics user (Phase 5) |
| `bonusret`   | Unclaimed bonus reserve returned to importer (Phase 5) |
| `bondstake`  | Logistics user staked their performance bond (Phase 5) |
| `bondredm`   | Performance bond redeemed to logistics user (Phase 5)  |
| `bondforf`   | Performance bond forfeited to importer (Phase 5)       |

---

## Storage & TTL

| Entry              | Type       | TTL target     |
|--------------------|------------|----------------|
| Platform address   | Instance   | 31 days        |
| USDC token address | Instance   | 31 days        |
| EscrowRecord       | Persistent | 31 days (auto-extended on every read/write) |
| Logistics users    | Persistent | 31 days (auto-extended on every read/write) |

---

## Security Notes

- **Re-entrancy**: Soroban's execution model is not susceptible to re-entrancy — state is committed atomically.
- **Overflow**: All arithmetic uses `checked_*` operations; overflow returns `EscrowError::ArithmeticError`.
- **Auth**: Every mutating function calls `require_auth()` on the relevant party before any state changes.
- **Idempotency**: `advance_stage` silently ignores backward / same-stage calls.
- **Duplicate escrows**: `create_escrow` rejects if the reference code already exists.
- **Evidence required**: `confirm_milestone` rejects empty evidence URIs at the contract level.
