export type UserType = 'TRADE_PARTY' | 'LOGISTICS_CHAIN' | 'ADMIN';

/**
 * Trade Party: 2 roles — the buyers and sellers of cargo.
 * Logistics Chain: 3 roles — the operators who physically move and clear goods.
 * Admin: 1 role — internal platform staff. NEVER exposed as a selectable option
 * anywhere in the sign-up or onboarding UI (app/(auth)/onboarding/page.tsx builds
 * its role checklists from hard-coded tradePartyJobs/logisticsJobs arrays only —
 * it never enumerates this union, so ADMIN can't appear there by construction).
 * Admin accounts are provisioned exclusively via scripts/create-admin.ts
 * (service-role, run out-of-band by a developer/ops person on their own machine),
 * never through /api/auth/register or /api/auth/onboarding.
 */
export type TradePartyRole = 'IMPORTER' | 'EXPORTER';
export type LogisticsChainRole = 'FREIGHT_FORWARDER' | 'WAREHOUSE_OPERATOR' | 'CUSTOMS_BROKER';
export type AdminRole = 'ADMIN';

export type JobRole = TradePartyRole | LogisticsChainRole | AdminRole;

export type KycStatus = 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';

export type ShipmentScope = 'NATIONWIDE' | 'OVERSEAS';

export type ShipmentStatus =
  | 'PENDING_EXPORTER'
  | 'COUNTER_OFFER'
  | 'CONFIRMED'
  | 'ESCROW_FUNDED'
  | 'IN_TRANSIT'
  | 'AT_PORT'
  | 'CUSTOMS_CLEARANCE'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DISPUTED'
  | 'CANCELLED';

export type EscrowStatus = 'UNFUNDED' | 'FUNDED' | 'RELEASED' | 'REFUNDED' | 'DISPUTED';

export type ChatThreadStatus = 'OPEN' | 'RECEIPT_FINALIZED' | 'RECEIPT_DRAFT' | 'CLOSED';

// ─── Negotiation currency ───────────────────────────────────────────────────

export type Currency = 'USD' | 'PHP' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'SGD';

export const SUPPORTED_CURRENCIES: Currency[] = ['USD', 'PHP', 'EUR', 'GBP', 'JPY', 'CNY', 'SGD'];

export const CURRENCY_LABELS: Record<Currency, string> = {
  USD: 'US Dollar',
  PHP: 'Philippine Peso',
  EUR: 'Euro',
  GBP: 'British Pound',
  JPY: 'Japanese Yen',
  CNY: 'Chinese Yuan',
  SGD: 'Singapore Dollar',
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  PHP: '₱',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  SGD: 'S$',
};

export type MilestoneType =
  // ─── 🏢 Freight Forwarder milestones ───
  // Booking & vessel coordination
  | 'BOOKING_CONFIRMED'
  | 'DOCUMENTS_SUBMITTED_TO_CARRIER'
  | 'SPACE_ON_VESSEL_SECURED'
  | 'CONTAINER_GATED_OUT_ORIGIN'
  | 'CONTAINER_LOADED_ON_VESSEL'
  | 'VESSEL_CLEARED_TO_DEPART'
  | 'VESSEL_DEPARTED_ORIGIN'
  | 'BILL_OF_LADING_ISSUED'
  // Destination legs
  | 'VESSEL_ARRIVED_AT_BERTH'
  | 'VESSEL_ARRIVED_DESTINATION'
  | 'CONTAINER_OFFLOADED'
  | 'CONTAINER_GATED_IN_DESTINATION'
  | 'CARGO_RELEASED_FOR_PICKUP'
  | 'IN_TRANSIT_TO_DESTINATION'
  | 'ARRIVED_AT_DELIVERY_ADDRESS'
  | 'DELIVERED_AND_SIGNED_OFF'
  // ─── 🛃 Customs Broker milestones ───
  | 'BOC_ENTRY_FILED'
  | 'PORT_HOLD_PLACED_OR_LIFTED'
  | 'DUTIES_AND_TAXES_PAID'
  | 'CUSTOMS_EXAMINATION_REQUESTED'
  | 'CUSTOMS_CLEARANCE_APPROVED'
  // ─── 🏬 Warehouse Operator milestones ───
  | 'CARGO_READY_FOR_COLLECTION'
  | 'CARGO_INSPECTED_AND_PACKED'
  | 'CARGO_STAGED_FOR_PICKUP'
  | 'CARGO_HANDED_OFF_TO_CARRIER'
  | 'CARGO_PICKED_UP_FROM_PORT'
  | 'CARGO_RECEIVED_AT_WAREHOUSE'
  | 'INCOMING_CARGO_STORED'
  | 'FAILED_DELIVERY_ATTEMPT';

/**
 * Canonical map of loggable milestones per job role.
 * Single source of truth — import this everywhere instead of
 * maintaining local copies (dashboard, log-milestone page, etc.).
 *
 * Derived directly from the role comments in MilestoneType above:
 * every milestone belongs to exactly one role.
 */
export const ROLE_MILESTONES: Record<JobRole, MilestoneType[]> = {
  // Trade Party — read-only observers, no milestone logging
  IMPORTER: [],
  EXPORTER: [],

  // Admin — internal staff, not part of the shipment milestone chain
  ADMIN: [],

  // ─── Logistics Chain ────────────────────────────────────────────────────

  FREIGHT_FORWARDER: [
    // Booking & vessel coordination
    'BOOKING_CONFIRMED',
    'DOCUMENTS_SUBMITTED_TO_CARRIER',
    'SPACE_ON_VESSEL_SECURED',
    'CONTAINER_GATED_OUT_ORIGIN',
    'CONTAINER_LOADED_ON_VESSEL',
    'VESSEL_CLEARED_TO_DEPART',
    'VESSEL_DEPARTED_ORIGIN',
    'BILL_OF_LADING_ISSUED',
    // Destination legs
    'VESSEL_ARRIVED_AT_BERTH',
    'VESSEL_ARRIVED_DESTINATION',
    'CONTAINER_OFFLOADED',
    'CONTAINER_GATED_IN_DESTINATION',
    'CARGO_RELEASED_FOR_PICKUP',
    'IN_TRANSIT_TO_DESTINATION',
    'ARRIVED_AT_DELIVERY_ADDRESS',
    'DELIVERED_AND_SIGNED_OFF',
  ],

  CUSTOMS_BROKER: [
    'BOC_ENTRY_FILED',
    'PORT_HOLD_PLACED_OR_LIFTED',
    'DUTIES_AND_TAXES_PAID',
    'CUSTOMS_EXAMINATION_REQUESTED',
    'CUSTOMS_CLEARANCE_APPROVED',
  ],

  WAREHOUSE_OPERATOR: [
    'CARGO_READY_FOR_COLLECTION',
    'CARGO_INSPECTED_AND_PACKED',
    'CARGO_STAGED_FOR_PICKUP',
    'CARGO_HANDED_OFF_TO_CARRIER',
    'CARGO_PICKED_UP_FROM_PORT',
    'CARGO_RECEIVED_AT_WAREHOUSE',
    'INCOMING_CARGO_STORED',
    'FAILED_DELIVERY_ATTEMPT',
  ],
};

// ─── Multi-role support ─────────────────────────────────────────────────────
// A single account can hold more than one JobRole at once (e.g. a Trade
// Party account that is both Importer and Exporter — common for SME
// traders who both buy and sell — or a Logistics Chain account that is
// simultaneously Freight Forwarder and Customs Broker, reflecting how a
// single trusted operator often wears several hats in practice). Roles
// must stay within one category: a user is either a Trade Party account
// (IMPORTER / EXPORTER, any combination) or a Logistics Chain account
// (FREIGHT_FORWARDER / WAREHOUSE_OPERATOR / CUSTOMS_BROKER, any
// combination) — never a mix of both categories.
//
// `User.jobRole` (singular) is retained as the "primary" / display role for
// legacy records and default UI selection. `User.jobRoles` (plural) is the
// source of truth for what the account can actually do. Use the helpers
// below rather than reading either field directly, so legacy single-role
// records (jobRoles missing or empty) keep working via the jobRole fallback.

/** Every job role a user holds. Falls back to `[user.jobRole]` for legacy
 *  records that predate multi-role support. */
export function getUserJobRoles(user: Pick<User, 'jobRole' | 'jobRoles'>): JobRole[] {
  if (user.jobRoles && user.jobRoles.length > 0) return user.jobRoles;
  return user.jobRole ? [user.jobRole] : [];
}

/** Whether the user holds the given role, across all their stacked roles. */
export function userHasJobRole(user: Pick<User, 'jobRole' | 'jobRoles'>, role: JobRole): boolean {
  return getUserJobRoles(user).includes(role);
}

/** The category (Trade Party vs Logistics Chain) a set of roles belongs to.
 *  Returns null for an empty list — callers should treat that as invalid. */
export function jobRoleCategory(roles: JobRole[]): UserType | null {
  const tradePartyRoles: JobRole[] = ['IMPORTER', 'EXPORTER'];
  const adminRoles: JobRole[] = ['ADMIN'];
  if (roles.length === 0) return null;
  if (roles.every(r => adminRoles.includes(r))) return 'ADMIN';
  return roles.every(r => tradePartyRoles.includes(r)) ? 'TRADE_PARTY' : 'LOGISTICS_CHAIN';
}

/** True if every role in the list belongs to the same category (Trade Party,
 *  Logistics Chain, or Admin) — roles may never mix across categories.
 *  ADMIN is intentionally exclusive of the other two categories: this is what
 *  keeps a self-service sign-up (register -> onboarding) from ever landing a
 *  user on ADMIN, since the onboarding role pickers only ever submit Trade
 *  Party or Logistics Chain roles and this check would reject a mix. */
export function areJobRolesConsistent(roles: JobRole[]): boolean {
  if (roles.length === 0) return false;
  const tradePartyRoles: JobRole[] = ['IMPORTER', 'EXPORTER'];
  const logisticsRoles: JobRole[] = ['FREIGHT_FORWARDER', 'WAREHOUSE_OPERATOR', 'CUSTOMS_BROKER'];
  const adminRoles: JobRole[] = ['ADMIN'];
  const allTrade = roles.every(r => tradePartyRoles.includes(r));
  const allLogistics = roles.every(r => logisticsRoles.includes(r));
  const allAdmin = roles.every(r => adminRoles.includes(r));
  return allTrade || allLogistics || allAdmin;
}

/** Union of every milestone type the user is authorized to log, across all
 *  their stacked job roles — e.g. a dual Freight-Forwarder + Customs-Broker
 *  account inherits both milestone sets, rather than being limited to one. */
export function getMilestonesForUser(user: Pick<User, 'jobRole' | 'jobRoles'>): MilestoneType[] {
  const roles = getUserJobRoles(user);
  const set = new Set<MilestoneType>();
  for (const r of roles) {
    for (const m of ROLE_MILESTONES[r]) set.add(m);
  }
  return Array.from(set);
}

/**
 * Phase labels for grouping milestones in the timeline UI.
 */
export type ShipmentPhase =
  | 'CARGO_PREPARATION'
  | 'ORIGIN_PORT_EXPORT'
  | 'OCEAN_TRANSIT_DESTINATION'
  | 'LAST_MILE_DELIVERY';

/** Maps each phase to its ordered milestone sequence. */
export const PHASE_MILESTONE_SEQUENCE: Record<ShipmentPhase, MilestoneType[]> = {
  CARGO_PREPARATION: [
    'BOOKING_CONFIRMED',
    'CARGO_INSPECTED_AND_PACKED',
    'CARGO_READY_FOR_COLLECTION',
    'CARGO_STAGED_FOR_PICKUP',
    'CARGO_HANDED_OFF_TO_CARRIER',
  ],
  ORIGIN_PORT_EXPORT: [
    'DOCUMENTS_SUBMITTED_TO_CARRIER',
    'SPACE_ON_VESSEL_SECURED',
    'CONTAINER_GATED_OUT_ORIGIN',
    'BOC_ENTRY_FILED',
    'CONTAINER_LOADED_ON_VESSEL',
    'VESSEL_CLEARED_TO_DEPART',
    'VESSEL_DEPARTED_ORIGIN',
    'BILL_OF_LADING_ISSUED',
  ],
  OCEAN_TRANSIT_DESTINATION: [
    'VESSEL_ARRIVED_AT_BERTH',
    'VESSEL_ARRIVED_DESTINATION',
    'CONTAINER_OFFLOADED',
    'CONTAINER_GATED_IN_DESTINATION',
    'PORT_HOLD_PLACED_OR_LIFTED',
    'CUSTOMS_EXAMINATION_REQUESTED',
    'DUTIES_AND_TAXES_PAID',
    'CUSTOMS_CLEARANCE_APPROVED',
    'CARGO_RELEASED_FOR_PICKUP',
  ],
  LAST_MILE_DELIVERY: [
    'CARGO_PICKED_UP_FROM_PORT',
    'CARGO_RECEIVED_AT_WAREHOUSE',
    'INCOMING_CARGO_STORED',
    'IN_TRANSIT_TO_DESTINATION',
    'ARRIVED_AT_DELIVERY_ADDRESS',
    'DELIVERED_AND_SIGNED_OFF',
  ],
};

// ─── Tracking page tiers ───────────────────────────────────────────────────
// Owned by the Importer — applies to every shipment they create and share a
// public tracking link for.
//   BRANDED    — status header only, MariTrade-branded link (default/free)
//   TIMELINE   — adds the full milestone-by-milestone handoff timeline
//   WHITELABEL — TIMELINE + custom logo / accent color on the public page
export type TrackingTier = 'BRANDED' | 'TIMELINE' | 'WHITELABEL';

export const TRACKING_TIER_LABELS: Record<TrackingTier, string> = {
  BRANDED: 'Branded Link',
  TIMELINE: 'Milestone Timeline',
  WHITELABEL: 'White-Label',
};

// ─── External Credentials (Pre-Verified badge) ────────────────────────────────
// Mixed-media prior-experience credentials any user (Trade Party or
// Logistics Chain) can attach to their public profile — proof of standing
// they bring *into* MariTrade, independent of in-platform KYC. Once a user
// has at least one credential on file, they're shown with a "Pre-Verified"
// badge everywhere they appear on MariNet.
//
//   CERTIFICATE_URL   — a link to an e-certificate hosted elsewhere (LinkedIn
//                        Learning, Credly, an issuing authority's verify page, etc.)
//   CERTIFICATE_IMAGE — a photographed/scanned certificate image, uploaded directly
//   RESUME_PDF        — an existing resume/CV, uploaded as a PDF
export type ExternalCredentialType = 'CERTIFICATE_URL' | 'CERTIFICATE_IMAGE' | 'RESUME_PDF';

export interface ExternalCredential {
  id: string;
  type: ExternalCredentialType;
  title: string;      // e.g. "Certified International Trade Professional"
  issuer?: string;     // e.g. "Philippine Chamber of Commerce"
  url: string;         // external link (URL type) or uploaded file URL (image/PDF types)
  addedAt: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  fullAddress?: string;
  contactNumber?: string;
  userType: UserType;
  /** Primary / display role — kept for legacy records and default UI selection.
   *  Prefer `jobRoles` + the getUserJobRoles()/getMilestonesForUser() helpers
   *  above for anything permission-related. */
  jobRole: JobRole;
  /** All job roles this account holds (stacked responsibilities). A Trade
   *  Party account may hold IMPORTER and/or EXPORTER; a Logistics Chain
   *  account may hold any combination of FREIGHT_FORWARDER,
   *  WAREHOUSE_OPERATOR, and CUSTOMS_BROKER. Roles never mix categories.
   *  May be empty/undefined on legacy records — use getUserJobRoles(user). */
  jobRoles: JobRole[];
  companyName?: string;
  stellarWallet?: string;
  bankDetails?: string;
  kycStatus: KycStatus;
  kycDocumentUrl?: string;
  trackingTier?: TrackingTier;
  brandingLogoUrl?: string;
  brandingPrimaryColor?: string;
  brandingCompanyLabel?: string;
  /** Multi-seat firm account this user belongs to, if any. */
  firmId?: string;
  firmRole?: FirmRole;
  /** Prior-experience credentials imported by the user — see ExternalCredential above. */
  externalCredentials?: ExternalCredential[];
  createdAt: string;
  updatedAt: string;
}

// ─── Team Seats (Multi-Seat Firm Accounts) ─────────────────────────────────
// A firm is a real entity multiple users can belong to — distinct from the
// free-text `companyName` field on User, which is purely cosmetic. Firm
// membership drives seat limits, invite management, shared shipment
// visibility between teammates, and assignment reassignment when a
// teammate leaves.

export type FirmRole = 'OWNER' | 'MEMBER';

export interface Firm {
  id: string;
  name: string;
  ownerId: string;
  seatLimit: number;
  createdAt: string;
  updatedAt: string;
}

export type FirmInviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED';

export interface FirmInvite {
  id: string;
  firmId: string;
  invitedEmail: string;
  invitedById: string;
  status: FirmInviteStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Shipment {
  id: string;
  referenceCode: string;
  importerId: string;
  exporterId?: string;
  description: string;
  originCountry: string;
  destinationPort: string;
  shipmentScope: ShipmentScope;
  status: ShipmentStatus;
  totalValueUSD: number;
  escrowStatus: EscrowStatus;
  escrowAmountUSD?: number;
  /**
   * Asset used to fund the escrow. Defaults to 'USDC'.
   * 'PPHP' means the importer chose Philippine Peso denomination —
   * the contract still holds USDC, but displays use the peso symbol.
   */
  escrowAsset?: 'USDC' | 'PPHP';
  stellarEscrowId?: string;
  estimatedArrival?: string;
  /** Why the importer raised a dispute (captured at confirm_raise_dispute time)
   *  — feeds the AI dispute-evidence summarizer shown to the arbitrator on
   *  the Admin Dispute Panel. Undefined for shipments that were never disputed. */
  disputeReason?: string;
  /** When the dispute was raised — undefined if never disputed. */
  disputeRaisedAt?: string;
  /** The negotiated/quoted freight (shipping) cost — distinct from
   *  totalValueUSD, which is the cargo/invoice value. Set by the assigned
   *  Freight Forwarder after booking, and used as the historical sample for
   *  the AI rate-benchmarking feature on future shipments over the same
   *  route. Undefined until a Freight Forwarder records it. */
  freightCostUSD?: number;
  /** Vessel identity for the AIS cross-check on VESSEL_DEPARTED_ORIGIN — set
   *  once a Freight Forwarder knows/books the vessel (captured alongside the
   *  SPACE_ON_VESSEL_SECURED milestone). MMSI, not IMO, since that's the key
   *  aisstream.io position reports are indexed by. Undefined until set. */
  vesselMmsi?: string;
  vesselName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentAssignment {
  id: string;
  shipmentId: string;
  userId: string;
  assignedAt: string;
}

export interface PriorityMilestone {
  id: string;
  shipmentId: string;
  type: MilestoneType;
  isCompleted: boolean;
}

// ─── Milestone evidence modes ────────────────────────────────────────────────
// REFERENCE_NUMBER — a text code from an external system (booking ref, container
//   number, BOC entry series, etc.). Stored in evidenceRef. Fast to enter and
//   actually meaningful for audit purposes.
// DOCUMENT — a file upload (B/L PDF, customs approval cert, official receipt).
//   Stored in evidenceUrl via the milestone-evidence Storage bucket.
// PHOTO_OR_NOTE — physical events where a photo is natural but a written note
//   is also acceptable. evidenceUrl is optional; description is required.
export type MilestoneEvidenceMode = 'REFERENCE_NUMBER' | 'DOCUMENT' | 'PHOTO_OR_NOTE';

export const MILESTONE_EVIDENCE_MODE: Record<MilestoneType, MilestoneEvidenceMode> = {
  // ── Freight Forwarder ──────────────────────────────────────────────────────
  BOOKING_CONFIRMED:               'REFERENCE_NUMBER', // booking ref / PO number
  DOCUMENTS_SUBMITTED_TO_CARRIER:  'REFERENCE_NUMBER', // carrier receipt ref
  SPACE_ON_VESSEL_SECURED:         'REFERENCE_NUMBER', // vessel / voyage number
  CONTAINER_GATED_OUT_ORIGIN:      'REFERENCE_NUMBER', // container number
  CONTAINER_LOADED_ON_VESSEL:      'REFERENCE_NUMBER', // container + vessel ref
  VESSEL_CLEARED_TO_DEPART:        'REFERENCE_NUMBER', // port clearance number
  VESSEL_DEPARTED_ORIGIN:          'REFERENCE_NUMBER', // vessel voyage ref
  BILL_OF_LADING_ISSUED:           'DOCUMENT',         // upload the B/L PDF
  VESSEL_ARRIVED_AT_BERTH:         'REFERENCE_NUMBER', // port arrival notice ref
  VESSEL_ARRIVED_DESTINATION:      'REFERENCE_NUMBER', // ETA confirmation ref
  CONTAINER_OFFLOADED:             'REFERENCE_NUMBER', // discharge ref
  CONTAINER_GATED_IN_DESTINATION:  'REFERENCE_NUMBER', // container number
  CARGO_RELEASED_FOR_PICKUP:       'REFERENCE_NUMBER', // release order number
  IN_TRANSIT_TO_DESTINATION:       'REFERENCE_NUMBER', // waybill / tracking number
  ARRIVED_AT_DELIVERY_ADDRESS:     'PHOTO_OR_NOTE',    // photo of arrival / POD note
  DELIVERED_AND_SIGNED_OFF:        'PHOTO_OR_NOTE',    // photo of signed delivery receipt
  // ── Customs Broker ────────────────────────────────────────────────────────
  BOC_ENTRY_FILED:                 'REFERENCE_NUMBER', // BOC entry series number
  PORT_HOLD_PLACED_OR_LIFTED:      'REFERENCE_NUMBER', // hold reference number
  DUTIES_AND_TAXES_PAID:           'DOCUMENT',         // upload Official Receipt
  CUSTOMS_EXAMINATION_REQUESTED:   'REFERENCE_NUMBER', // examination order number
  CUSTOMS_CLEARANCE_APPROVED:      'DOCUMENT',         // upload CAO / release cert
  // ── Warehouse Operator ────────────────────────────────────────────────────
  CARGO_READY_FOR_COLLECTION:      'REFERENCE_NUMBER', // collection notice ref
  CARGO_INSPECTED_AND_PACKED:      'PHOTO_OR_NOTE',    // inspection photo
  CARGO_STAGED_FOR_PICKUP:         'REFERENCE_NUMBER', // staging ref / bay number
  CARGO_HANDED_OFF_TO_CARRIER:     'REFERENCE_NUMBER', // handoff receipt number
  CARGO_PICKED_UP_FROM_PORT:       'REFERENCE_NUMBER', // gate pass / pickup ref
  CARGO_RECEIVED_AT_WAREHOUSE:     'PHOTO_OR_NOTE',    // receiving photo / GR note
  INCOMING_CARGO_STORED:           'REFERENCE_NUMBER', // storage location / bin ref
  FAILED_DELIVERY_ATTEMPT:         'PHOTO_OR_NOTE',    // photo + reason required
};

// Human-readable labels for the reference number field per milestone
export const MILESTONE_EVIDENCE_REF_LABEL: Record<MilestoneType, string> = {
  BOOKING_CONFIRMED:               'Booking Reference / PO Number',
  DOCUMENTS_SUBMITTED_TO_CARRIER:  'Carrier Receipt Reference',
  SPACE_ON_VESSEL_SECURED:         'Vessel / Voyage Number',
  CONTAINER_GATED_OUT_ORIGIN:      'Container Number',
  CONTAINER_LOADED_ON_VESSEL:      'Container & Vessel Reference',
  VESSEL_CLEARED_TO_DEPART:        'Port Clearance Number',
  VESSEL_DEPARTED_ORIGIN:          'Vessel Voyage Reference',
  BILL_OF_LADING_ISSUED:           '', // document — no ref label
  VESSEL_ARRIVED_AT_BERTH:         'Port Arrival Notice Reference',
  VESSEL_ARRIVED_DESTINATION:      'ETA Confirmation Reference',
  CONTAINER_OFFLOADED:             'Discharge Reference',
  CONTAINER_GATED_IN_DESTINATION:  'Container Number',
  CARGO_RELEASED_FOR_PICKUP:       'Release Order Number',
  IN_TRANSIT_TO_DESTINATION:       'Waybill / Tracking Number',
  ARRIVED_AT_DELIVERY_ADDRESS:     '', // photo or note
  DELIVERED_AND_SIGNED_OFF:        '', // photo or note
  BOC_ENTRY_FILED:                 'BOC Entry Series Number',
  PORT_HOLD_PLACED_OR_LIFTED:      'Hold Reference Number',
  DUTIES_AND_TAXES_PAID:           '', // document — no ref label
  CUSTOMS_EXAMINATION_REQUESTED:   'Examination Order Number',
  CUSTOMS_CLEARANCE_APPROVED:      '', // document — no ref label
  CARGO_READY_FOR_COLLECTION:      'Collection Notice Reference',
  CARGO_INSPECTED_AND_PACKED:      '', // photo or note
  CARGO_STAGED_FOR_PICKUP:         'Staging Reference / Bay Number',
  CARGO_HANDED_OFF_TO_CARRIER:     'Handoff Receipt Number',
  CARGO_PICKED_UP_FROM_PORT:       'Gate Pass / Pickup Reference',
  CARGO_RECEIVED_AT_WAREHOUSE:     '', // photo or note
  INCOMING_CARGO_STORED:           'Storage Location / Bin Reference',
  FAILED_DELIVERY_ATTEMPT:         '', // photo or note
};

// ─── Phase 3 — Independently-Verifiable Evidence ───────────────────────────
// Corroborating data sources that reduce reliance on self-reported evidence.
// Every mechanism here degrades gracefully to the manual flow above
// (reference number / document / photo) if the integration or a feed is
// unavailable — it never blocks a milestone from being logged.

// ── IoT sensor ingestion (shock/humidity/GPS tags) ─────────────────────────
export type IoTReadingType = 'TEMPERATURE' | 'HUMIDITY' | 'SHOCK' | 'GPS' | 'DOOR_OPEN';

export interface IoTSensorReading {
  id: string;
  shipmentId: string;
  /** The milestone this reading corroborates, once one has been logged that
   *  falls within the reading's time window. Undefined for readings that
   *  arrived before any matching milestone was logged (still stored — the
   *  milestone route backfills the link when it later matches). */
  milestoneEventId?: string;
  deviceId: string;
  readingType: IoTReadingType;
  value: number;
  unit: string;
  latitude?: number;
  longitude?: number;
  recordedAt: string;
  createdAt: string;
}

/** A container/cargo sensor device registered against a shipment, so its
 *  webhook posts can be authenticated and attributed. */
export interface IoTDevice {
  id: string;
  shipmentId: string;
  deviceId: string;
  label?: string;
  registeredById: string;
  createdAt: string;
}

// ── Vessel-tracking (AIS) cross-check ───────────────────────────────────────
export type AisVerificationStatus = 'VERIFIED' | 'MISMATCH' | 'UNVERIFIABLE';

export interface AisVerificationResult {
  status: AisVerificationStatus;
  vesselName?: string;
  imoNumber?: string;
  /** What the logistics user claimed (the reference number they typed in). */
  claimedReference?: string;
  /** What the public AIS feed reported, if reachable. */
  aisObservedAt?: string;
  source: string;      // e.g. 'AISHub', 'unconfigured'
  checkedAt: string;
  note?: string;        // human-readable reason for MISMATCH/UNVERIFIABLE
}

/** A cached last-known position for one vessel (by MMSI), kept fresh by the
 *  standalone scripts/ais-worker.ts process consuming aisstream.io's
 *  WebSocket feed. The app only ever reads this — never calls aisstream.io
 *  directly, since that's a push API with no request/response endpoint. */
export interface AisVesselPosition {
  mmsi: string;
  shipName?: string;
  imoNumber?: string;
  latitude?: number;
  longitude?: number;
  sogKnots?: number;
  navStatus?: string;
  receivedAt: string;
  updatedAt: string;
}

// ── Digital signature capture at delivery ───────────────────────────────────
export type SignerRelation = 'CONSIGNEE' | 'AUTHORIZED_REPRESENTATIVE' | 'OTHER';

export interface DeliverySignature {
  id: string;
  milestoneEventId: string;
  shipmentId: string;
  signerName: string;
  signerRelation: SignerRelation;
  /** Base64 PNG data URL captured from the in-app signature pad. */
  signatureImageDataUrl: string;
  /** True once the signer verified an OTP sent to their phone/email — ties
   *  the signature to the recipient's identity rather than just a pad tap. */
  otpVerified: boolean;
  /** Masked contact the OTP was sent to, e.g. "+63 9** *** **21". */
  otpVerifiedContactMasked?: string;
  signedAt: string;
}

// ── Recipient-side confirmation flow ─────────────────────────────────────────
export type RecipientConfirmationStatus = 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'EXPIRED';

export interface RecipientConfirmation {
  id: string;
  shipmentId: string;
  /** Linked once ARRIVED_AT_DELIVERY_ADDRESS is logged and this request
   *  corroborates it. */
  milestoneEventId?: string;
  /** Phone or email the confirmation link/OTP was sent to. */
  consigneeContact: string;
  consigneeName?: string;
  status: RecipientConfirmationStatus;
  /** Opaque token used in the public /confirm-delivery/[token] link — never
   *  the row id, so it can be rotated/invalidated independently. */
  confirmationToken: string;
  requestedById: string;
  requestedAt: string;
  respondedAt?: string;
  disputeNote?: string;
}

export interface MilestoneEvent {
  id: string;
  shipmentId: string;
  loggedById: string;
  type: MilestoneType;
  description?: string;
  evidenceUrl?: string;  // file upload URL — required for DOCUMENT, optional for PHOTO_OR_NOTE
  evidenceRef?: string;  // reference number — required for REFERENCE_NUMBER
  occurredAt: string;
  verified: boolean;
  /** VESSEL_DEPARTED_ORIGIN only — best-effort public AIS cross-check result.
   *  Undefined for every other milestone type, and undefined here too if the
   *  check was never attempted (e.g. AIS integration not configured). */
  aisVerification?: AisVerificationResult;
}

export interface ShipmentDocument {
  id: string;
  shipmentId: string;
  fileName: string;
  fileUrl: string;
  uploadedById: string;
  version: number;
  isLatest: boolean;
  createdAt: string;
}

export interface ChatThread {
  id: string;
  status: ChatThreadStatus;
  shipmentId?: string;
  cargoDescription?: string;
  createdAt: string;
  updatedAt: string;
  // Group chat fields
  isGroup?: boolean;
  groupName?: string;
}

// ─── Shipment Receipt — collaborative shipment-creation planner ───────────
// Lives on a (Trade Party) chat thread. Both the importer and the exporter
// can edit the same receipt while they chat; once either side finalizes it,
// it becomes read-only and shows up as a pickable card on the
// "Create Shipment" page so its fields can be used to prefill the form.

export type ReceiptStatus = 'DRAFT' | 'FINALIZED';

export interface ShipmentReceipt {
  id: string;
  threadId: string;
  status: ReceiptStatus;

  // ── Cargo ──
  cargoDescription?: string;
  shipmentScope?: ShipmentScope;
  estimatedArrival?: string;

  // ── Parties ──
  importerContact?: string;
  exporterContact?: string;

  // ── Route ──
  originCountry?: string;
  originAddress?: string;
  originPort?: string;
  destCountry?: string;
  destAddress?: string;
  destinationPort?: string;

  // ── Commercial value ──
  invoiceCurrency?: Currency;
  invoiceValue?: number;
  totalValueUSD?: number;
  hsCode?: string;

  // ── Physical specifications ──
  isDangerousGoods?: boolean;
  packageCount?: number;
  packagingType?: string;
  grossWeight?: number;
  weightUnit?: 'KG' | 'LBS';

  lastEditedById?: string;
  finalizedById?: string;
  finalizedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatParticipant {
  id: string;
  threadId: string;
  userId: string;
}

// ─── B2B Vendor Network ────────────────────────────────────────────────────

export type ConnectionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface ConnectionRequest {
  id: string;
  requesterId: string;   // The Importer who sent the request
  receiverId: string;    // The logistics chain vendor
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
  /** User ids who have starred this connection as a favorite/saved counterparty.
   *  Personal per-user, not shared — check `favoritedBy.includes(currentUserId)`. */
  favoritedBy?: string[];
  /** User ids (Trade Party side) who have flagged this connection as a
   *  "Preferred Partner" — powers the assignment fast-track. Personal
   *  per-user, same shape as `favoritedBy`. Only meaningful when the
   *  flagging user is a Trade Party and the other party is Logistics
   *  Chain, but the field itself doesn't enforce that — callers do. */
  preferredBy?: string[];
}

// ─── BOC Document Vault ──────────────────────────────────────────────────────

export interface VaultFolder {
  id: string;
  shipmentId: string;
  referenceCode: string;  // mirrors Shipment.referenceCode for easy lookup
  folderName: string;     // custom display name set at shipment creation
  password: string;       // plain-text for demo; hash server-side in production
  createdByUserId: string;
  createdAt: string;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  createdAt: string;
  imageUrl?: string;
  isUnsent?: boolean;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export type NotificationType =
  | 'MILESTONE_LOGGED'       // A logistics partner logged a milestone on your shipment
  | 'ESCROW_FUNDED'          // Escrow was funded
  | 'ESCROW_RELEASED'        // Escrow funds were released
  | 'MESSAGE_RECEIVED'       // New chat message
  | 'CONNECTION_REQUEST'     // Someone sent you a connection request
  | 'CONNECTION_ACCEPTED'    // Your connection request was accepted
  | 'SHIPMENT_ASSIGNED'      // You were assigned/added as a party to a shipment
  | 'SHIPMENT_STATUS_CHANGE' // Shipment status changed
  | 'FIRM_INVITE'            // You were invited to join a team/firm
  | 'FIRM_INVITE_ACCEPTED'   // Someone accepted your firm invite
  | 'FIRM_MEMBER_REMOVED'    // You were removed from a firm
  | 'SHIPMENT_REASSIGNED'    // A shipment assignment was reassigned to you
  // ─── Phase 4 · Proactive, externally-triggered nudges ───
  | 'PORT_CONGESTION_ALERT'      // Logistics Chain: an external signal suggests delay risk ahead of arrival
  | 'PROACTIVE_DELAY_DISCLOSURE'; // Trade Party: the importer is told about the same risk, independently of logistics logging anything

export interface AppNotification {
  id: string;
  userId: string;              // Recipient
  type: NotificationType;
  title: string;
  body: string;
  linkHref?: string;           // Optional deep-link inside the app
  isRead: boolean;
  createdAt: string;
}

// ─── Phase 4 · Proactive, externally-triggered nudges ─────────────────────
// A detected external delay signal (port congestion, customs backlog, etc.)
// for an active shipment, raised by the app/api/cron/delay-monitor cron job.
// Stored primarily so the same signal isn't re-notified every cron tick —
// see lib/delay-signals.ts for the provider interface and
// lib/db.ts#getRecentDelayAlert for the dedupe window this backs.
export type DelaySignalSource = 'PORT_CONGESTION' | 'CUSTOMS_BACKLOG';
export type DelayAlertSeverity = 'ADVISORY' | 'WARNING';

export interface ShipmentDelayAlert {
  id: string;
  shipmentId: string;
  source: DelaySignalSource;
  severity: DelayAlertSeverity;
  /** Short human-readable line, e.g. "Port of Manila reporting elevated dwell times". */
  summary: string;
  /** Raw detail from the provider, if any — shown to logistics users, not the importer. */
  detail?: string;
  detectedAt: string;
  /** Set once the assigned logistics users have been notified for this alert. */
  notifiedLogisticsAt?: string;
  /** Set once the importer has been notified for this alert (proactive disclosure). */
  notifiedImporterAt?: string;
}

// ─── Saved Shipment List Views ─────────────────────────────────────────────
// Personal, per-user presets for the Shipments list page filters/sort —
// lets a user save "Active overseas shipments sorted by ETA" etc. and
// re-apply it in one click instead of re-selecting filters each visit.

export interface ShipmentListFilters {
  status?: ShipmentStatus[];
  shipmentScope?: ShipmentScope[];
  escrowStatus?: EscrowStatus[];
  search?: string;
}

export type ShipmentSortField = 'createdAt' | 'estimatedArrival' | 'totalValueUSD' | 'referenceCode';
export type SortDirection = 'asc' | 'desc';

export interface SavedShipmentView {
  id: string;
  userId: string;
  name: string;
  filters: ShipmentListFilters;
  sortBy: ShipmentSortField;
  sortDir: SortDirection;
  createdAt: string;
}
