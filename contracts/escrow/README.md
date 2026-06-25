# MariTrade Escrow Contract

Soroban smart contract that powers MariTrade's shipment payment escrow system.
USDC is locked at shipment creation and released only when all importer-selected
priority milestones are confirmed by the logistics chain.

---

## Architecture

```
Importer
  │  create_escrow()   ← registers vault, selects milestones
  │  fund()            ← deposits USDC via SAC transfer
  │  release()         ← sends USDC to exporter (after all milestones)
  │  cancel()          ← refund per stage policy
  │  raise_dispute()   ← IN_TRANSIT → platform arbitration
  ▼
[MariTrade Escrow Contract]
  │
  ├── Logistics Users
  │     confirm_milestone()  ← with evidence URI (IPFS / HTTPS)
  │
  └── MariTrade Platform
        advance_stage()      ← PRE_DEPARTURE → IN_TRANSIT → DELIVERED
        cancel()             ← co-sign for PRE_DEPARTURE refunds
        resolve_dispute()    ← split funds in arbitration
```

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
