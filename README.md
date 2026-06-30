# MariTrade V2

MariTrade is a digital shipment tracking and trade-finance platform built for Filipino SME importers, exporters, and logistics chains. It pairs a Next.js web app with a Stellar/Soroban smart-contract escrow system, so payment for a shipment is locked on-chain and only released as milestones in the shipping process are confirmed.

## Why it exists

Cross-border trade between small Philippine importers and overseas exporters is usually settled either fully up front (risky for the importer) or on trust after delivery (risky for the exporter). MariTrade removes that trust gap: USDC is escrowed at shipment creation, and funds move automatically as agreed milestones (departure, customs clearance, arrival, delivery, etc.) are confirmed by the logistics participants involved in the shipment.

## Core features

- **Shipment tracking** — importers, exporters, and logistics partners share a single timeline for each shipment, with milestone evidence (documents/photos) attached at each stage.
- **On-chain escrow** — a Soroban smart contract holds USDC for a shipment and releases it according to a configurable milestone and cancellation policy (see `contracts/escrow`).
- **PHP wallet** — a simulated Philippine Peso Stellar asset used for local-currency flows alongside USDC, with scripts to mint and set up trustlines.
- **Role-based dashboards** — separate dashboard views for importers, logistics users, and platform admins, with a network/contacts module, messaging, document storage, and payment history.
- **Public shipment tracking** — a public, no-login tracking page for sharing shipment status with parties outside the platform.

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
│   └── api/                 Route handlers: auth, shipments, milestones, stellar,
│                            vault, messages, notifications, network, upload, gemini, admin
├── components/             Shared UI components (dashboard layout, asset selector,
│                            PPHP wallet panel, auth provider, etc.)
├── contracts/escrow/        Soroban escrow smart contract (Rust) — see its own README
├── hooks/                   React hooks
├── lib/
│   ├── escrow/               Client-side helpers for the escrow contract
│   ├── stellar/              Stellar SDK integration, escrow bindings
│   ├── gemini/                Gemini AI integration
│   ├── permissions/           Role/permission logic
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
- A [Google Gemini API key](https://ai.google.dev/) (optional, only needed for AI autofill)
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
