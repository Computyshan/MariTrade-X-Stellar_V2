# MariTrade V2

https://mari-trade-x-stellar.vercel.app/

MariTrade is a digital shipment tracking and trade-finance platform built for Filipino SME importers, exporters, and logistics chains. It pairs a Next.js web app with a Stellar/Soroban smart-contract escrow system, so payment for a shipment is locked on-chain and only released as milestones in the shipping process are confirmed.

## Why it exists

Cross-border trade between small Philippine importers and overseas exporters is usually settled either fully up front (risky for the importer) or on trust after delivery (risky for the exporter). MariTrade removes that trust gap: USDC is escrowed at shipment creation, and funds move automatically as agreed milestones (departure, customs clearance, arrival, delivery, etc.) are confirmed by the logistics participants involved in the shipment.

## Core features

- **Shipment tracking** — importers, exporters, and logistics partners share a single timeline for each shipment, with milestone evidence (documents/photos) attached at each stage, plus a live ETA countdown per shipment.
- **On-chain escrow** — a Soroban smart contract holds USDC (or PPHP) for a shipment and releases it according to a configurable milestone policy, with a stage-dependent (`UNFUNDED` / `PRE_DEPARTURE` / `IN_TRANSIT` / `DELIVERED`) cancellation, refund, and dispute/arbitration flow (see `contracts/escrow`).
- **PHP wallet** — a simulated Philippine Peso Stellar asset used for local-currency flows alongside USDC, with scripts to mint and set up trustlines, and live USD→PHP conversion shown alongside escrow balances.
- **Role-based dashboards** — separate dashboard views for importers, logistics users, and platform admins, with a network/contacts module, messaging, document storage, and payment history.
- **Public shipment tracking** — a public, no-login tracking page, plus a one-click copyable tracking link, for sharing shipment status with parties outside the platform.
- **BOC Vault documents centre** — role-gated (Trade Party / Customs Broker only) upload and storage of encrypted Bureau of Customs compliance documents per shipment.

### AI-assisted decision support (Gemini)

- **Delay-risk prediction** — flags shipments likely to face customs holds or delays for Logistics Chain users, based on route/cargo history plus a Gemini read of the cargo.
- **Rate benchmarking** — gives Freight Forwarders a data-backed negotiating floor from platform-wide historical freight costs on the same route.
- **HS code classification assistant** — Gemini-suggested tariff codes for Customs Brokers to confirm.
- **Milestone-requirement recommender** — suggests which priority milestones to require at shipment creation based on cargo type/route risk.
- **Dispute-evidence summarizer** — summarizes the milestone/evidence trail for arbitrators when a dispute is filed.
- **In-app AI assistant, autofill, and FAQ** — Gemini-backed chat assistant and form autofill helpers.

All AI output is treated as a suggestion for a human to confirm, never an autonomous decision.

### Independently-verifiable evidence

- **Live vessel position / AIS tracking** — cross-checks logged departure milestones and shows real-time vessel position once a vessel MMSI is captured.
- **IoT sensor readings** — temperature/humidity/shock/GPS/door sensor tags can be registered per shipment and report readings that corroborate milestone evidence instead of relying solely on operator photos.
- **Digital signature capture at delivery** — an in-app signature pad for `DELIVERED_AND_SIGNED_OFF`, with optional OTP identity verification of the signer (phone or email).
- **Recipient-side confirmation** — a one-time link lets the named consignee independently confirm or dispute receipt, so delivery proof isn't solely supplied by the logistics side.

### Direct system integrations (Phase 5)

Each of the following auto-logs the relevant milestone as system-verified when configured, and transparently falls back to manual milestone logging when a provider isn't connected for a deployment — never blocking the shipment:

- **Carrier booking API** — Freight Forwarders book vessel/container space and get a system-verified `BOOKING_CONFIRMED`.
- **BOC e2m filing** — Customs Brokers file customs entries and confirm duty payment directly through MariTrade.
- **Duty pre-funding** — importers pre-authorize estimated BOC duty so a Customs Broker can capture it directly, without a separate payment channel.
- **Trade finance links** — importers link a Letter of Credit or other financing instrument to a shipment, snapshotting escrow status at link time.
- **Port/terminal gate webhook** — ingests terminal gate-in/gate-out events.

### Reputation & network

- **Performance scorecards** — computed on-time / dispute-rate / evidence-completeness stats surfaced on the Network directory for logistics partners.
- **Connections directory** — search and connect with counterparties and logistics partners on MariNet.

### Proactive monitoring

- **Delay-monitor cron job** — a background job polls for delay signals and can proactively notify affected parties ahead of a logged milestone.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend / App | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| State | Zustand, React Hook Form + Zod |
| Backend / Data | Supabase (Postgres, Auth) |
| Blockchain | Stellar (Soroban smart contracts, Rust), Stellar SDK, Freighter wallet |
| AI | Google Gemini API (`@google/genai`) |

## Project structure

```
maritrade-v2/
├── app/                    Next.js App Router
│   ├── (auth)/              Sign-in / sign-up flows
│   ├── (dashboard)/         Authenticated app: dashboard, shipments, payments,
│   │                        documents, messages, network, profile, settings, admin
│   ├── (public)/track/      Public shipment tracking page (no login required)
│   └── api/                 Route handlers: auth, shipments (milestones, escrow-cancel,
│                            escrow-release-prep, delivery-signature, recipient-confirmation,
│                            iot-devices/iot-readings, carrier-booking, boc-filing,
│                            duty-prefunding, trade-finance), stellar, vault, messages,
│                            notifications, network (connections/directory/scorecard),
│                            upload, gemini (delay-risk, rate-benchmark, hs-code,
│                            milestone-recommendation, dispute-summary, assistant, autofill,
│                            faq, estimate), analytics, port-gate webhook, vessels,
│                            cron (delay-monitor), admin
├── components/             Shared UI components (dashboard layout, asset selector, PPHP
│                            wallet panel, auth provider, shipment-detail subcomponents,
│                            vessel position card, IoT readings panel, Phase 5 integrations
│                            panel, etc.)
├── contracts/escrow/        Soroban escrow smart contract (Rust) — see its own README
├── hooks/                   React hooks (session, Freighter wallet, cancel/dispute flow, etc.)
├── lib/
│   ├── escrow/               Client-side helpers for the escrow contract
│   ├── stellar/              Stellar SDK integration, escrow bindings, FX helpers
│   ├── gemini/                Gemini AI integration
│   ├── integrations/          Carrier booking, BOC e2m, duty pre-funding, trade finance
│   │                          (Phase 5 direct system integrations; degrade gracefully to
│   │                          manual milestone logging when a provider isn't configured)
│   ├── verification/          AIS vessel-tracking cross-checks, other evidence verification
│   ├── permissions/           Role/permission logic
│   ├── server/                Server-only helpers
│   ├── delay-risk.ts, delay-signals.ts, rate-benchmark.ts, reputation.ts, eta.ts
│   ├── auth-guard.ts, db.ts, notify.ts, supabase.ts, utils.ts
├── supabase/                Database migrations and seed data
├── scripts/                 Operational scripts (mint PPHP asset, set up trustlines)
├── types/                   Shared TypeScript types
└── public/, assets/         Static assets
```

## Smart contract (escrow)

The Soroban escrow contract that backs shipment payments lives in `contracts/escrow/`. It locks USDC on shipment funding, advances through `UNFUNDED → PRE_DEPARTURE → IN_TRANSIT → DELIVERED` stages, supports milestone confirmation by logistics users, and has a stage-dependent cancellation/refund and dispute-resolution policy. Build, test, and deployment instructions are documented in `contracts/escrow/README.md`.

## Getting started

### Prerequisites

- Node.js and [pnpm](https://pnpm.io/)
- A [Supabase](https://supabase.com/) project
- A [Google Gemini API key](https://ai.google.dev/) (optional, only needed for AI chatbot)
- Rust + the `wasm32-unknown-unknown` target and the Stellar CLI, if you intend to build/deploy the escrow contract yourself

### Install

```bash
pnpm install
```

### Configure environment

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

This includes your Supabase URL/anon key, Gemini API key, Stellar network selection (testnet/mainnet), the deployed escrow contract address, the USDC SAC address, the PPHP issuer, and the platform Stellar secret key (server-side only).

### Run the app

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

### Other scripts

```bash
pnpm build                  # production build
pnpm lint                   # lint the codebase
pnpm mint-pphp               # mint the PPHP simulated peso asset
pnpm setup-pphp-trustline     # set up a PPHP trustline for an account
```

## Database

Supabase migrations live in `supabase/migrations/`, with a `supabase/seed-users.sql` script for seeding test accounts. Apply migrations through the Supabase CLI or dashboard for your project.

## License

MIT — see [LICENSE](./LICENSE).
