# MariTrade — AI Coding Starter Prompt v2
> Final version. Supersedes the previous starter prompt entirely. Copy this into Antigravity IDE/CLI, Google AI Studio, or Claude Web to scaffold the MariTrade build.

---

## PASTE THIS INTO YOUR AI CODING ASSISTANT:

---

You are building **MariTrade** — a digital shipping tracker platform powered by Stellar blockchain escrow, built for Filipino SME importers and the logistics chains that serve them. This is a real product. Write production-quality code throughout.

---

## PRODUCT OVERVIEW

MariTrade solves three problems for Filipino businesses:
1. **No payment protection** — funds are held in Stellar escrow and only released when shipment milestones are confirmed
2. **No shipment visibility** — every handoff across the logistics chain is logged and tracked in real time
3. **No document control** — all shipping and customs documents are stored and organized per shipment in the BOC document center

---

## TWO USER TYPES

### Trade Party
Both Importer and Exporter. They initiate deals, create shipment records, fund escrow, and release payments. Jobs available: Importer, Exporter, Company Owner, Trader.

### Logistics Chain
They log milestone events that trigger escrow releases. They do NOT touch money. Jobs available: Freight Forwarder, Shipping Line / Captain, Customs Broker, Warehouse Operator, Port Authority Officer, Trucker. All share the same dashboard layout but have different milestone actions per job.

**Critical permission rule:** Customs Brokers are the only Logistics Chain users with read and download access to the full BOC document section for their assigned shipments. All other Logistics Chain users can only view shipment details and milestone logs.

---

## TECH STACK — DO NOT DEVIATE

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript throughout — strict mode |
| Styling | Tailwind CSS + shadcn/ui (slate base color) |
| Database | Supabase (Postgres + Auth + Realtime + Storage) |
| ORM | Prisma |
| Blockchain | Stellar SDK (stellar-sdk npm package) |
| Notifications | Resend (email) + Twilio (SMS, PH numbers) |
| Map | Mapbox GL JS |
| State | Zustand |
| Forms | React Hook Form + Zod |
| AI (Phase 3) | Google Gemini API (gemini-1.5-pro) — scaffold only |

Install packages:
```bash
npm install stellar-sdk @supabase/supabase-js @supabase/auth-helpers-nextjs prisma @prisma/client zustand react-hook-form zod @hookform/resolvers mapbox-gl @types/mapbox-gl resend lucide-react date-fns @google/generative-ai
```

---

## FOLDER STRUCTURE

```
/app
  /(auth)              → login, register, onboarding
  /(dashboard)
    /dashboard         → home dashboard (role-aware)
    /shipments         → shipment list
    /shipments/[id]    → shipment detail + milestone timeline
    /shipments/new     → create shipment (multi-step)
    /messages          → contact/chat system
    /documents         → BOC document center
    /payments          → escrow status and history
    /settings          → account settings
  /(public)
    /                  → landing page
    /track/[code]      → public tracking page (no auth)
/components
  /ui                  → shadcn primitives
  /shipment            → shipment-specific components
  /milestone           → milestone timeline components
  /chat                → messaging components
  /dashboard           → dashboard widgets
/lib
  /stellar             → Stellar SDK wrapper
  /supabase            → Supabase client (server + client)
  /gemini              → Gemini service (scaffold only)
  /permissions         → role-based access helpers
/hooks                 → custom React hooks
/types                 → TypeScript interfaces
/prisma                → schema.prisma
```

---

## DESIGN SYSTEM

MariTrade's identity: maritime precision meets Filipino warmth. Clean, trustworthy, modern.

**Tailwind color palette** (add to tailwind.config.ts):
```typescript
colors: {
  maritime: {
    50:  '#EEF4FF',
    100: '#C8DBFF',
    200: '#90B8FF',
    400: '#1A66FF',   // primary CTAs
    700: '#002D8A',   // sidebar active
    900: '#001240',   // sidebar background
  },
  coral: {
    50:  '#FFF2EE',
    400: '#FF5C35',   // alerts, disputes, errors
    600: '#CC3A1C',
  },
  ocean: {
    50:  '#F0FAFA',
    100: '#CCEFEF',
    400: '#0BAFB0',   // confirmed milestones, success
    600: '#078384',
  },
  sand: {
    50:  '#FAFAF7',   // page background
    100: '#F2F1EC',   // card background
    200: '#E5E3DA',   // borders
  },
}
```

**Design rules:**
- Page bg: `sand-50`. Cards: white + `sand-200` border + `rounded-xl`
- Primary button: `maritime-400`, white text, `rounded-lg`
- Sidebar: `maritime-900` bg, white text, `maritime-700` active left border
- Milestone confirmed: `ocean-400` circle + checkmark
- Milestone pending: `sand-200` circle + clock
- Milestone failed/disputed: `coral-400` circle + alert
- Chat "Deal Agreed" thread: `ocean-50` bg with `ocean-400` left border
- Chat "Counter Offer" thread: amber-50 bg with amber-400 left border
- No heavy shadows. Consistent 24px padding.

---

## PRISMA SCHEMA `/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id              String      @id @default(uuid())
  email           String      @unique
  fullName        String
  fullAddress     String?
  contactNumber   String?
  userType        UserType
  jobRole         JobRole
  companyName     String?
  stellarWallet   String?     // optional — Phase 2
  bankDetails     String?     // encrypted, Trade Party only
  kycStatus       KycStatus   @default(PENDING)
  kycDocumentUrl  String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  shipmentsAsImporter   Shipment[]          @relation("Importer")
  shipmentsAsExporter   Shipment[]          @relation("Exporter")
  assignedShipments     ShipmentAssignment[]
  milestoneEvents       MilestoneEvent[]
  sentMessages          Message[]           @relation("Sender")
  receivedMessages      Message[]           @relation("Receiver")
  chatThreads           ChatParticipant[]
}

enum UserType {
  TRADE_PARTY
  LOGISTICS_CHAIN
}

enum JobRole {
  // Trade Party jobs
  IMPORTER
  EXPORTER
  COMPANY_OWNER
  TRADER
  // Logistics Chain jobs
  FREIGHT_FORWARDER
  SHIPPING_LINE_CAPTAIN
  CUSTOMS_BROKER
  WAREHOUSE_OPERATOR
  PORT_AUTHORITY_OFFICER
  TRUCKER
}

enum KycStatus {
  PENDING
  SUBMITTED
  VERIFIED
  REJECTED
}

model Shipment {
  id                  String          @id @default(uuid())
  referenceCode       String          @unique  // MT-YYYY-NNNNN
  importerId          String
  exporterId          String?
  description         String
  originCountry       String
  destinationPort     String
  shipmentScope       ShipmentScope   // NATIONWIDE or OVERSEAS
  status              ShipmentStatus  @default(PENDING_EXPORTER)
  totalValueUSD       Float
  escrowStatus        EscrowStatus    @default(UNFUNDED)
  escrowAmountUSD     Float?
  stellarEscrowId     String?
  estimatedArrival    DateTime?
  importer            User            @relation("Importer", fields: [importerId], references: [id])
  exporter            User?           @relation("Exporter", fields: [exporterId], references: [id])
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  milestones          MilestoneEvent[]
  documents           ShipmentDocument[]
  assignments         ShipmentAssignment[]
  priorityMilestones  PriorityMilestone[]
  chatThread          ChatThread?
}

enum ShipmentScope {
  NATIONWIDE   // PHP, e-wallets accepted
  OVERSEAS     // USD/foreign, bank/international transfer
}

enum ShipmentStatus {
  PENDING_EXPORTER       // waiting for exporter accept/counter/reject
  COUNTER_OFFER          // exporter countered, waiting for importer
  CONFIRMED              // exporter accepted, importer creating record
  ESCROW_FUNDED          // escrow funded, shipment active
  IN_TRANSIT
  AT_PORT
  CUSTOMS_CLEARANCE
  OUT_FOR_DELIVERY
  DELIVERED
  DISPUTED
  CANCELLED
}

enum EscrowStatus {
  UNFUNDED
  FUNDED
  RELEASED
  REFUNDED
  DISPUTED
}

// Which logistics users are assigned to a shipment
model ShipmentAssignment {
  id          String   @id @default(uuid())
  shipmentId  String
  userId      String
  assignedAt  DateTime @default(now())
  shipment    Shipment @relation(fields: [shipmentId], references: [id])
  user        User     @relation(fields: [userId], references: [id])

  @@unique([shipmentId, userId])
}

// Milestones the importer marks as REQUIRED for escrow release
model PriorityMilestone {
  id          String        @id @default(uuid())
  shipmentId  String
  type        MilestoneType
  isCompleted Boolean       @default(false)
  shipment    Shipment      @relation(fields: [shipmentId], references: [id])
}

model MilestoneEvent {
  id           String        @id @default(uuid())
  shipmentId   String
  loggedById   String
  type         MilestoneType
  description  String?
  evidenceUrl  String        // required — photo or document proof
  occurredAt   DateTime      @default(now())
  verified     Boolean       @default(false)

  shipment     Shipment @relation(fields: [shipmentId], references: [id])
  loggedBy     User     @relation(fields: [loggedById], references: [id])
}

enum MilestoneType {
  // Freight Forwarder
  BOOKING_CONFIRMED
  DOCUMENTS_SUBMITTED_TO_CARRIER
  CARGO_READY_FOR_COLLECTION
  SPACE_ON_VESSEL_SECURED
  // Shipping Line / Captain
  BILL_OF_LADING_ISSUED
  CONTAINER_LOADED_ON_VESSEL
  VESSEL_DEPARTED_ORIGIN
  VESSEL_ARRIVED_DESTINATION
  CONTAINER_OFFLOADED
  // Customs Broker
  BOC_ENTRY_FILED
  DUTIES_AND_TAXES_PAID
  CUSTOMS_EXAMINATION_REQUESTED
  CUSTOMS_CLEARANCE_APPROVED
  CARGO_RELEASED_FOR_PICKUP
  // Warehouse Operator
  CARGO_RECEIVED_AT_WAREHOUSE
  CARGO_INSPECTED_AND_PACKED
  CARGO_STAGED_FOR_PICKUP
  CARGO_HANDED_OFF_TO_CARRIER
  INCOMING_CARGO_STORED
  // Port Authority
  VESSEL_CLEARED_TO_DEPART
  CONTAINER_GATED_OUT_ORIGIN
  VESSEL_ARRIVED_AT_BERTH
  CONTAINER_GATED_IN_DESTINATION
  PORT_HOLD_PLACED_OR_LIFTED
  // Trucker
  CARGO_PICKED_UP_FROM_PORT
  IN_TRANSIT_TO_DESTINATION
  ARRIVED_AT_DELIVERY_ADDRESS
  DELIVERED_AND_SIGNED_OFF
  FAILED_DELIVERY_ATTEMPT
}

model ShipmentDocument {
  id            String       @id @default(uuid())
  shipmentId    String
  fileName      String
  fileUrl       String
  uploadedById  String
  version       Int          @default(1)
  isLatest      Boolean      @default(true)
  createdAt     DateTime     @default(now())
  shipment      Shipment     @relation(fields: [shipmentId], references: [id])
}

// Chat system
model ChatThread {
  id          String            @id @default(uuid())
  status      ChatThreadStatus  @default(OPEN)
  shipmentId  String?           @unique  // linked after Convert to Shipment
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  participants ChatParticipant[]
  messages     Message[]
  shipment     Shipment?        @relation(fields: [shipmentId], references: [id])
}

enum ChatThreadStatus {
  OPEN
  DEAL_AGREED       // after Convert to Shipment pressed
  COUNTER_OFFER     // after exporter hits Counter
  CLOSED
}

model ChatParticipant {
  id       String     @id @default(uuid())
  threadId String
  userId   String
  thread   ChatThread @relation(fields: [threadId], references: [id])
  user     User       @relation(fields: [userId], references: [id])

  @@unique([threadId, userId])
}

model Message {
  id         String     @id @default(uuid())
  threadId   String
  senderId   String
  content    String
  createdAt  DateTime   @default(now())
  thread     ChatThread @relation(fields: [threadId], references: [id])
  sender     User       @relation("Sender", fields: [senderId], references: [id])
  receivers  User[]     @relation("Receiver")
}
```

---

## SUPABASE ROW LEVEL SECURITY RULES

Write these RLS policies in Supabase after running migrations:

```sql
-- Users can only read their own profile
CREATE POLICY "users_own_profile" ON "User"
  FOR ALL USING (auth.uid()::text = id);

-- Trade Party: can read/write shipments they are importer or exporter on
CREATE POLICY "trade_party_shipments" ON "Shipment"
  FOR ALL USING (
    auth.uid()::text = "importerId" OR
    auth.uid()::text = "exporterId"
  );

-- Logistics Chain: can read shipments they are assigned to
CREATE POLICY "logistics_read_assigned" ON "Shipment"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "ShipmentAssignment"
      WHERE "shipmentId" = "Shipment".id
      AND "userId" = auth.uid()::text
    )
  );

-- Logistics Chain: can only log milestones on assigned shipments
CREATE POLICY "logistics_log_milestones" ON "MilestoneEvent"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "ShipmentAssignment"
      WHERE "shipmentId" = "MilestoneEvent"."shipmentId"
      AND "userId" = auth.uid()::text
    )
  );

-- BOC documents: Trade Party full access, Customs Broker read only, others no access
CREATE POLICY "documents_trade_party" ON "ShipmentDocument"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "Shipment" s
      WHERE s.id = "ShipmentDocument"."shipmentId"
      AND (s."importerId" = auth.uid()::text OR s."exporterId" = auth.uid()::text)
    )
  );

CREATE POLICY "documents_customs_broker_read" ON "ShipmentDocument"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "User" u
      JOIN "ShipmentAssignment" sa ON sa."userId" = u.id
      WHERE u.id = auth.uid()::text
      AND u."jobRole" = 'CUSTOMS_BROKER'
      AND sa."shipmentId" = "ShipmentDocument"."shipmentId"
    )
  );
```

---

## ACCOUNT CREATION + ONBOARDING

### Registration `/app/(auth)/register/page.tsx`
Two-path auth:
- Primary: "Continue with Google" (Supabase Google OAuth)
- Secondary: Email + password form

Fields collected on the registration form:
- Full name
- Full address
- Contact number (PH format +63)
- Password (if not Google)

After registration → redirect to `/onboarding`

### Onboarding Wizard `/app/(auth)/onboarding/page.tsx`
4-step wizard with progress bar:

**Step 1 — User type selection:**
- Two large cards: "Trade Party" (I buy or sell goods) vs "Logistics Chain" (I move goods)
- Selection gates what appears in Step 2

**Step 2 — Job role:**
- Dropdown gated by Step 1 selection
- Trade Party options ONLY: Importer, Exporter, Company Owner, Trader
- Logistics Chain options ONLY: Freight Forwarder, Shipping Line / Captain, Customs Broker, Warehouse Operator, Port Authority Officer, Trucker
- Never show both lists together

**Step 3 — Identity and company KYC:**
- For both user types: government ID upload (Supabase Storage) + company/employer name
- For Trade Party only: bank account details field (mark as sensitive, encrypt at rest)
- Stellar wallet field: show as optional, greyed out, labelled "Coming soon — Phase 2"

**Step 4 — Review and confirm:**
- Summary of all entries
- "Complete setup" → sets kycStatus to SUBMITTED → redirect to /dashboard

---

## CONTACT AND CHAT SYSTEM

### Chat list `/app/(dashboard)/messages/page.tsx`
- List of all chat threads the user is a participant in
- Thread shows: other participant name, last message preview, timestamp, thread status badge
- Status badges:
  - OPEN → gray
  - DEAL_AGREED → `ocean-400` green
  - COUNTER_OFFER → amber

### Chat thread `/app/(dashboard)/messages/[threadId]/page.tsx`
- Message bubbles (sent right, received left)
- For Trade Party → Trade Party threads only: show "Convert to shipment" button when thread status is OPEN
- When "Convert to shipment" is clicked:
  - Thread status → DEAL_AGREED
  - Thread gets a `ocean-50` background with "Deal agreed" banner
  - Pop-up form opens pre-filled with negotiated details
  - Exporter receives notification in chat

### Exporter notification panel
When an importer creates a shipment form, the exporter sees a notification card inside the chat thread with:
- Shipment summary (cargo, value, origin, destination)
- Three action buttons: "Accept", "Counter", "Reject"
- If Accept → shipment proceeds to record creation, status → CONFIRMED
- If Counter → thread status → COUNTER_OFFER, amber banner appears, importer notified. Exporter types counter terms in chat. Importer can only Accept or Decline. If importer accepts counter, they must press "Convert to shipment" again to create a new form with updated terms.
- If Reject → thread closed, no shipment created

---

## SHIPMENT CREATE FLOW `/app/(dashboard)/shipments/new/page.tsx`

Multi-step form (4 steps). Only available after exporter accepts.

**Step 1 — Scope and details:**
- Shipment scope toggle: **Nationwide** (PHP) or **Overseas** (USD/foreign)
  - This is a per-shipment decision, NOT an account setting
  - If Nationwide: show PHP currency label, note e-wallets accepted
  - If Overseas: show USD label, note bank/international transfer required
- "Import from chat" button → auto-fills form from Deal Agreed chat thread
- Fields: origin country, destination port, cargo description, estimated value, ETA

**Step 2 — Documents:**
- Upload area for shipping documents (any file type, stored in Supabase Storage)
- All uploads auto-routed to BOC document center grouped by this shipment's reference code
- "Skip for now" allowed with warning

**Step 3 — Assign logistics users + set priority milestones:**
- Search field: find logistics users by MariTrade username or company name
- Add them to the assigned list → they get notified and gain milestone logging access
- Priority milestone checklist: importer selects which MilestoneTypes are REQUIRED for escrow release
- Default suggested set: CUSTOMS_CLEARANCE_APPROVED + DELIVERED_AND_SIGNED_OFF
- Importer can add/remove any milestone from the full MilestoneType enum
- "Release funds" button stays LOCKED until all priority milestones are confirmed

**Step 4 — Fund escrow:**
- Summary: cargo, value, scope, assigned users, priority milestones
- Show escrow amount in USDC
- If Nationwide: also show PHP equivalent (indicative rate, label it clearly)
- "Fund escrow via Stellar" button → triggers Stellar payment flow
- After funding: escrowStatus → FUNDED, shipment becomes visible to assigned logistics users
- Auto-generate reference code: MT-YYYY-NNNNN

---

## LOGISTICS CHAIN DASHBOARD

All 6 job types share the same dashboard layout. What differs per job: available milestone types, actions, and document permissions.

### Shared layout `/app/(dashboard)/dashboard/page.tsx` (logistics view)

**Sidebar navigation:**
- My Shipments → assigned shipments list
- Log Milestone → quick action
- Messages → chat
- Settings

**Assigned shipments list:**
- Search bar: search by reference code, cargo description, importer name
- Each row: reference code, scope badge, current status, ETA, "Log milestone" button

**Shipment detail (logistics view) `/app/(dashboard)/shipments/[id]/page.tsx`:**
- Read-only header: reference, origin → destination, ETA
- Milestone timeline: full history of all logged events
- "Log milestone" panel (right column):
  - Milestone type dropdown — only shows milestone types valid for their job role
  - Description field (optional)
  - Proof upload (required — cannot submit without a file)
  - Submit button

### Job-specific milestone type filters

Apply these filters in the milestone type dropdown based on `user.jobRole`:

```typescript
const MILESTONE_BY_JOB: Record<JobRole, MilestoneType[]> = {
  FREIGHT_FORWARDER: [
    'BOOKING_CONFIRMED',
    'DOCUMENTS_SUBMITTED_TO_CARRIER',
    'CARGO_READY_FOR_COLLECTION',
    'SPACE_ON_VESSEL_SECURED',
  ],
  SHIPPING_LINE_CAPTAIN: [
    'BILL_OF_LADING_ISSUED',
    'CONTAINER_LOADED_ON_VESSEL',
    'VESSEL_DEPARTED_ORIGIN',
    'VESSEL_ARRIVED_DESTINATION',
    'CONTAINER_OFFLOADED',
  ],
  CUSTOMS_BROKER: [
    'BOC_ENTRY_FILED',
    'DUTIES_AND_TAXES_PAID',
    'CUSTOMS_EXAMINATION_REQUESTED',
    'CUSTOMS_CLEARANCE_APPROVED',
    'CARGO_RELEASED_FOR_PICKUP',
  ],
  WAREHOUSE_OPERATOR: [
    'CARGO_RECEIVED_AT_WAREHOUSE',
    'CARGO_INSPECTED_AND_PACKED',
    'CARGO_STAGED_FOR_PICKUP',
    'CARGO_HANDED_OFF_TO_CARRIER',
    'INCOMING_CARGO_STORED',
  ],
  PORT_AUTHORITY_OFFICER: [
    'VESSEL_CLEARED_TO_DEPART',
    'CONTAINER_GATED_OUT_ORIGIN',
    'VESSEL_ARRIVED_AT_BERTH',
    'CONTAINER_GATED_IN_DESTINATION',
    'PORT_HOLD_PLACED_OR_LIFTED',
  ],
  TRUCKER: [
    'CARGO_PICKED_UP_FROM_PORT',
    'IN_TRANSIT_TO_DESTINATION',
    'ARRIVED_AT_DELIVERY_ADDRESS',
    'DELIVERED_AND_SIGNED_OFF',
    'FAILED_DELIVERY_ATTEMPT',
  ],
}
```

### BOC document access by job role
```typescript
// In /lib/permissions/documents.ts
export function canAccessBOCDocuments(jobRole: JobRole): boolean {
  return jobRole === 'CUSTOMS_BROKER';
}

export function canDownloadDocuments(jobRole: JobRole): boolean {
  return jobRole === 'CUSTOMS_BROKER';
}
```
All other logistics users see a "Documents restricted" placeholder in the document section. Only Trade Party users and Customs Brokers can view and download BOC documents.

---

## TRADE PARTY DASHBOARD

### Importer dashboard `/app/(dashboard)/dashboard/page.tsx`

**4 stat cards:**
- Active shipments
- Funds in escrow (USDC + PHP equivalent)
- Delivered this month
- Pending milestone confirmations

**Recent shipments table:**
Columns: Reference, Scope (badge), Origin, Status, ETA, Escrow, Actions

Status badge colors:
- PENDING_EXPORTER → gray
- COUNTER_OFFER → amber
- CONFIRMED → `maritime-100` blue
- ESCROW_FUNDED → `maritime-400` blue
- IN_TRANSIT → `ocean-400` teal
- CUSTOMS_CLEARANCE → `maritime-100`
- DELIVERED → green
- DISPUTED → `coral-400` red

**Live milestone activity feed (right column):**
- Supabase Realtime subscription on MilestoneEvent for user's shipments
- Shows: job role icon + milestone type + shipment reference + time ago

---

## SHIPMENT DETAIL PAGE (Trade Party view)

### Top section
- Reference code (monospace, large)
- Scope badge (NATIONWIDE / OVERSEAS)
- Status + ETA
- "View on Stellar" link if stellarEscrowId exists

### Milestone timeline (60% width)
- Vertical timeline of all logged MilestoneEvents
- Completed priority milestones: `ocean-400` filled circle + checkmark
- Pending priority milestones: `maritime-400` pulsing circle
- Non-priority milestones: `sand-200` circle
- Each entry: milestone type label, logged by (name + job role), timestamp, evidence download link

### Escrow panel (40% width)
- Amount in USDC
- If NATIONWIDE: PHP equivalent below (label: "indicative rate")
- UNFUNDED → "Fund escrow" button
- FUNDED → "Escrow active" lock icon in `ocean-400`
- All priority milestones confirmed → "Release funds" button activates
  - Importer must upload receipt/proof before release is processed
  - After upload → release button becomes active → triggers Stellar release
- RELEASED → "Payment released" confirmation

### BOC Documents section
- Grid of all documents for this shipment
- Each card: filename, upload date, version number, download button
- Version > 1 shows "Amended" badge
- "Upload document" button → modal with file upload
- All uploads auto-grouped under this shipment's reference in the BOC center

---

## BOC DOCUMENT CENTER `/app/(dashboard)/documents/page.tsx`

- Lists all shipments the user has documents for
- Click a shipment → expand to show all documents for that shipment
- Documents grouped by shipment reference code (NOT by document type)
- Trade Party: full read + upload + download access to their shipments
- Customs Broker: read + download only, for assigned shipments
- All other Logistics Chain: no access (redirect to "Access restricted" page)

---

## ESCROW CANCELLATION LOGIC

Implement cancellation authorization checks in `/lib/escrow/cancellation.ts`:

```typescript
type CancellationStage =
  | 'UNFUNDED'
  | 'PRE_DEPARTURE'
  | 'IN_TRANSIT'
  | 'DELIVERED'

type CancellationPolicy = {
  allowed: boolean
  refundType: 'FULL' | 'PARTIAL' | 'DISPUTED' | 'NONE'
  authorizedBy: 'IMPORTER_ONLY' | 'BOTH_PARTIES_MARITRADE' | 'MARITRADE_ARBITRATION' | 'NONE'
}

export function getCancellationPolicy(stage: CancellationStage): CancellationPolicy {
  switch (stage) {
    case 'UNFUNDED':
      return { allowed: true, refundType: 'FULL', authorizedBy: 'IMPORTER_ONLY' }
    case 'PRE_DEPARTURE':
      return { allowed: true, refundType: 'PARTIAL', authorizedBy: 'BOTH_PARTIES_MARITRADE' }
    case 'IN_TRANSIT':
      return { allowed: true, refundType: 'DISPUTED', authorizedBy: 'MARITRADE_ARBITRATION' }
    case 'DELIVERED':
      return { allowed: false, refundType: 'NONE', authorizedBy: 'NONE' }
  }
}
```

---

## STELLAR SERVICE `/lib/stellar/escrow.ts`

```typescript
import * as StellarSdk from 'stellar-sdk';

const server = new StellarSdk.Horizon.Server('https://horizon.stellar.org');
const networkPassphrase = StellarSdk.Networks.PUBLIC;

// Check USDC balance of a Stellar account
export async function getAccountBalance(publicKey: string): Promise<{
  xlm: string;
  usdc: string;
}> { ... }

// Create multisig escrow transaction (buyer + seller + MariTrade platform)
// Returns XDR string for user to sign
export async function createEscrowTransaction(params: {
  buyerPublicKey: string;
  sellerPublicKey: string;
  amountUSDC: string;
  shipmentReferenceCode: string;
  platformPublicKey: string;
}): Promise<string> { ... }

// Release escrow to seller after all priority milestones confirmed
export async function releaseEscrow(params: {
  escrowAccountPublicKey: string;
  sellerPublicKey: string;
  amountUSDC: string;
  platformSecretKey: string;
}): Promise<string> { ... }

// Watch Stellar account for incoming payments (escrow funding detection)
export async function watchAccount(
  publicKey: string,
  onPayment: (payment: StellarSdk.ServerApi.PaymentOperationRecord) => void
): Promise<void> { ... }
```

---

## GEMINI SERVICE SCAFFOLD `/lib/gemini/index.ts`

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// TODO Phase 3: Auto-fill BOC customs form from uploaded invoice
export async function autofillBOCForm(invoiceText: string): Promise<Record<string, string>> {
  throw new Error('TODO: Phase 3');
}

// TODO Phase 3: AI freight cost estimator
export async function estimateFreightCost(params: {
  originCountry: string;
  destinationPort: string;
  cargoWeightKg: number;
  cargoType: string;
}): Promise<{ estimatedUSD: number; confidence: string; breakdown: string }> {
  throw new Error('TODO: Phase 3');
}

// TODO Phase 3: Tagalog AI assistant
export async function tagalogAssistant(userMessage: string, context?: string): Promise<string> {
  throw new Error('TODO: Phase 3');
}

// TODO Phase 4: Typhoon rerouting
export async function typhoonRerouting(params: {
  currentRoute: string;
  weatherData: string;
}): Promise<{ suggestedRoute: string; reason: string }> {
  throw new Error('TODO: Phase 4');
}
```

---

## API ROUTES

```
POST /api/auth/register
POST /api/auth/onboarding

GET  /api/shipments
POST /api/shipments
GET  /api/shipments/[id]
PATCH /api/shipments/[id]
POST /api/shipments/[id]/accept        → exporter accepts
POST /api/shipments/[id]/counter       → exporter counters
POST /api/shipments/[id]/reject        → exporter rejects
POST /api/shipments/[id]/milestones    → log milestone (logistics only)
POST /api/shipments/[id]/documents     → upload document
POST /api/shipments/[id]/assign        → assign logistics user
POST /api/shipments/[id]/release       → importer releases escrow
POST /api/shipments/[id]/cancel        → cancellation request

GET  /api/messages/threads
POST /api/messages/threads
GET  /api/messages/threads/[id]
POST /api/messages/threads/[id]        → send message
POST /api/messages/threads/[id]/convert → Convert to Shipment action

POST /api/stellar/escrow
POST /api/stellar/release

GET  /api/track/[referenceCode]        → public, no auth required
```

---

## PUBLIC TRACKING PAGE `/app/(public)/track/[referenceCode]/page.tsx`

No auth required. Shareable link.
- Shipment reference, origin → destination, scope badge
- Current status + ETA
- Read-only milestone timeline (same visual as dashboard)
- NO financial data shown (no escrow amounts, no document access)
- "Sign up to MariTrade" CTA at bottom

---

## ENV VARS `.env.local`

```
NEXT_PUBLIC_STELLAR_NETWORK=public
STELLAR_PLATFORM_PUBLIC_KEY=
STELLAR_PLATFORM_SECRET_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
RESEND_API_KEY=
NEXT_PUBLIC_MAPBOX_TOKEN=
GEMINI_API_KEY=
```

---

## GENERAL CODING RULES

1. All TypeScript — no `any`. Define all interfaces in `/types/index.ts`
2. Server Components by default — `'use client'` only for forms, realtime, map
3. API routes return `{ success: boolean, data?: T, error?: string }`
4. Every data-fetching component needs a skeleton loader
5. Dashboard sidebar collapses to bottom nav on mobile
6. Never hardcode secrets — all via `.env.local`
7. Apply Supabase RLS policies as defined above
8. Use shadcn/ui Toaster for all success/error feedback
9. Every list/table needs an empty state with a helpful CTA
10. All interactive elements need proper aria labels
11. Job role gates: enforce `MILESTONE_BY_JOB` and `canAccessBOCDocuments()` on both API and UI layers — never trust the client alone
12. Proof upload is REQUIRED for milestone submission — the API must reject milestone logs without an `evidenceUrl`

---

## BUILD PRIORITY ORDER

1. Project setup + Tailwind config + design system
2. Prisma schema + Supabase connection + RLS policies
3. Landing page
4. Auth (Google OAuth + email-password fallback)
5. Onboarding wizard (4 steps, role-gated job picker)
6. Dashboard layout + sidebar (role-aware: Trade Party vs Logistics Chain)
7. Trade Party dashboard home (stats + shipments table + activity feed)
8. Chat / contact system (threads, messages, Convert to Shipment, Counter flow)
9. Shipment create flow (4 steps: scope, docs, assign + milestones, fund escrow)
10. Shipment detail page (timeline + escrow panel + documents)
11. Logistics Chain dashboard (assigned shipments + milestone logging panel)
12. BOC document center (grouped by shipment, permissions enforced)
13. Public tracking page
14. Stellar service scaffold
15. Gemini service scaffold
16. Cancellation logic

---

Start with step 1. Build and verify each step compiles and renders before moving to the next. Ask if any product decision is unclear.
