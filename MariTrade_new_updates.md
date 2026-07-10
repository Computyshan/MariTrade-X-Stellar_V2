# MariTrade — Implementation Plan: Increasing Platform Influence Over Real-World Freight Actions

**Goal:** MariTrade currently digitizes the *record* of freight actions (milestone logs, evidence, escrow state) but not the actions themselves. This plan lists features for both user types — **Trade Party** (Importer/Exporter) and **Logistics Chain** (Freight Forwarder/Customs Broker/Warehouse Operator) — that increase the platform's real influence over what actually happens in a shipment, not just what gets reported about it.

Features are grouped by mechanism, then sequenced into build phases. Each item notes which existing system it hooks into (`types/index.ts`, the Soroban escrow contract, Gemini AI, the Network module, etc.) so it's traceable to the current codebase.

---

## 1. Direct System Integration (highest-leverage category)

Turns "log what happened elsewhere" into "the filing happens through MariTrade."

### Logistics Chain
- **BOC e2m / customs EDI integration** — Customs Brokers file `BOC_ENTRY_FILED` and `DUTIES_AND_TAXES_PAID` directly through MariTrade instead of pasting a reference number after filing elsewhere. MariTrade receives the government's own confirmation, not a self-report.
- **Carrier booking API integration** — Freight Forwarders book vessel/container space (`BOOKING_CONFIRMED`, `SPACE_ON_VESSEL_SECURED`) through a carrier API from inside the app, so the booking reference is system-verified, not typed in.
- **Port/terminal gate system webhook** — Auto-populate `CONTAINER_GATED_OUT_ORIGIN` / `CONTAINER_GATED_IN_DESTINATION` from terminal operating system events instead of manual entry.

### Trade Party
- **Bank/wallet integration for duty pre-funding** — Importers pre-authorize duty payment through MariTrade's wallet rails so the Customs Broker doesn't need a separate payment channel outside the platform.
- **Letter of credit / trade finance hooks** — For larger shipments, let importers link an LC or financing product that itself references the MariTrade escrow status, deepening the platform's role beyond a single payment rail.

**Build note:** Start with whichever government/carrier system has a public sandbox API (BOC or a single carrier) as a pilot before generalizing.

---

## 2. Escrow-as-Incentive (extends the existing Soroban contract)

Uses money already in MariTrade's control to shape behavior, not just gate it.

### Logistics Chain
- **Speed-based partial release bonus** — Small bonus tranche released if a milestone (e.g. `CUSTOMS_CLEARANCE_APPROVED`) is confirmed within a target SLA window from cargo arrival. Requires extending `EscrowRecord`/contract logic beyond binary milestone-complete.
- **Performance bond / stake requirement** — High-value shipments require the assigned Logistics Chain user to stake a bond (via a separate Soroban vault) that's forfeited on confirmed damage/dispute-loss, redeemed on clean delivery.

### Trade Party
- **Milestone selection incentive** — Let importers offer an optional bonus for specific milestones they care about most (e.g. temperature-sensitive cargo → bonus tied to `CARGO_INSPECTED_AND_PACKED` evidence quality), configurable at `create_escrow()`.
- **Early-release discount for repeat trusted counterparties** — Reduce the number of required priority milestones for exporters/logistics partners with a strong track record (ties into #4 below), speeding up trade for proven partners.

**Build note:** This requires new fields in `EscrowRecord` and new contract entrypoints — plan for a `contracts/escrow` v2, not a v1 patch, and re-run the full test suite (`cargo test`) plus new integration scenarios.

---

## 3. Independently-Verifiable Evidence (shrinks the "self-reported" gap)

### Logistics Chain
- **IoT sensor ingestion** — Shock/humidity/GPS tags on containers report directly to MariTrade, auto-attaching to `PHOTO_OR_NOTE` milestones (`CARGO_INSPECTED_AND_PACKED`, `ARRIVED_AT_DELIVERY_ADDRESS`) as corroborating data instead of relying solely on operator photos.
- **Vessel-tracking cross-check** — Before accepting `VESSEL_DEPARTED_ORIGIN` on-chain, cross-check against a public AIS/vessel-tracking API, the same pattern already used in `verifyOnChainRelease` for release claims.
- **Digital signature capture at delivery** — Replace the `PHOTO_OR_NOTE` for `DELIVERED_AND_SIGNED_OFF` with an in-app signature pad tied to the recipient's identity (OTP or ID scan), rather than a photo of a paper signature.

### Trade Party
- **Recipient-side confirmation flow** — Importer (or a named consignee) gets a push notification to confirm receipt in-app at `ARRIVED_AT_DELIVERY_ADDRESS`, so the "proof" isn't solely supplied by the logistics side.

**Build note:** IoT and AIS integrations are third-party API contracts — budget for per-provider onboarding, not a single generic connector.

---

## 4. Reputation & Marketplace Pressure (uses the existing Network module)

### Logistics Chain
- **Public performance scorecards** — Extend `ConnectionRequest`/network profiles with computed stats: average time-to-clear, on-time %, dispute rate, milestone-evidence completeness. Surfaced wherever a logistics user appears on MariNet.
- **Verified-badge tiers beyond `ExternalCredential`** — A performance-based badge (not just uploaded certificates) that only accrues from in-platform track record, unlockable perks (e.g., reduced required milestones per #2).

### Trade Party
- **Importer/Exporter reliability scores** — Mirror scorecards for Trade Party accounts (on-time funding, dispute-initiation rate, payment promptness) so logistics partners can also choose who to work with — makes the marketplace pressure bidirectional.
- **"Preferred partner" fast-track** — Importers can flag high-scoring logistics partners for streamlined assignment (skip manual selection) on future shipments.

**Build note:** This is mostly additive to existing `types/index.ts` (`ConnectionRequest`, `User`) — lowest engineering risk in this plan, good early win.

---

## 5. AI-Assisted Decision Support (extends the existing Gemini integration)

### Logistics Chain
- **HS code classification assistant** — Gemini suggests likely tariff codes from cargo description/photos for Customs Brokers to confirm, reducing misclassification risk without removing the broker's judgment call.
- **Rate benchmarking** — Gemini/analytics surfaces recent platform-wide rates for similar routes/cargo, giving Freight Forwarders a data-backed floor when negotiating with carriers.
- **Delay-risk prediction** — Model flags shipments likely to face customs holds or port congestion based on route/cargo-type history, prompting proactive prep.

### Trade Party
- **Milestone-requirement recommender** — When creating a shipment, Gemini suggests which priority milestones to require based on cargo type/route risk (e.g., always require `CUSTOMS_CLEARANCE_APPROVED` for high-tariff goods), instead of the importer picking from a blank list.
- **Dispute-evidence summarizer** — When a dispute is filed, Gemini summarizes the milestone/evidence trail for the arbitrator (still human-decided, but faster and more consistent review).

**Build note:** Reuse the existing `/api/gemini/*` route pattern; keep all of these as *suggestions the human confirms*, never auto-applied, to avoid liability for misclassification/mispricing.

---

## 6. Proactive, Externally-Triggered Nudges

### Logistics Chain
- **Congestion/backlog alerts** — Pull port congestion or customs backlog feeds and push "expect delay, start prep now" notifications to assigned logistics users ahead of arrival.
- **SLA countdown surfacing** — Show a live countdown to milestone deadlines (tied to #2 incentives) directly on the dashboard, not just a static assignment list.

### Trade Party
- **Proactive delay disclosure** — Notify importers automatically the moment an external signal (weather, port strike, customs backlog) suggests their shipment is at risk, before the logistics user even logs anything — shifts MariTrade from reactive ledger to active shipment monitor.

**Build note:** Requires a background job/worker layer (not present yet) to poll external feeds and fan out notifications via the existing `notify.ts` infrastructure.

---

## Suggested Build Phases

| Phase | Focus | Features | Why this order |
|---|---|---|---|
| **Phase 1** (quick wins, low risk) | Reputation & marketplace pressure | #4 all items | Pure additions to existing `types`/`Network`, no contract changes, no third-party integration risk |
| **Phase 2** (AI layer) | Decision support | #5 all items | Reuses existing Gemini route pattern; suggestions-only keeps liability low |
| **Phase 3** (evidence hardening) | Verifiable evidence | #3 all items | Requires new third-party integrations (IoT, AIS) but no contract changes |
| **Phase 4** (proactive layer) | Nudges & monitoring | #6 all items | Needs a new background-worker layer; build after Phase 1–3 stabilize the data model it depends on |
| **Phase 5** (deepest, highest payoff) | System integration + escrow incentives | #1 and #2 | Requires external partner integrations (government/carrier APIs) and a new escrow contract version — highest engineering and compliance cost, so sequenced last despite being highest-leverage |

---

## Cross-Cutting Notes

- Every feature above should degrade gracefully to today's manual flow (reference number / document / photo) if an integration or feed is unavailable — mirrors the existing pattern where `onChainStageSync` reports success/failure without blocking the milestone log itself.
- Anything touching money (Phase 5 escrow incentives) needs its own contract test suite additions (`contracts/escrow/src/tests.rs`) before mainnet deployment, per the existing security-notes discipline in the contract README.
- AI suggestions (Phase 2) should always be logged as "AI-suggested, human-confirmed" in the audit trail, never presented as an autonomous decision — keeps MariTrade's liability posture consistent with its current "platform provides record, human provides judgment" model.
