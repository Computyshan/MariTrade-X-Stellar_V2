export type UserType = 'TRADE_PARTY' | 'LOGISTICS_CHAIN';

/**
 * Trade Party: 2 roles — the buyers and sellers of cargo.
 * Logistics Chain: 3 roles — the operators who physically move and clear goods.
 */
export type TradePartyRole = 'IMPORTER' | 'EXPORTER';
export type LogisticsChainRole = 'FREIGHT_FORWARDER' | 'WAREHOUSE_OPERATOR' | 'CUSTOMS_BROKER';

export type JobRole = TradePartyRole | LogisticsChainRole;

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
  if (roles.length === 0) return null;
  return roles.every(r => tradePartyRoles.includes(r)) ? 'TRADE_PARTY' : 'LOGISTICS_CHAIN';
}

/** True if every role in the list belongs to the same category (Trade Party
 *  or Logistics Chain) — roles may never mix across categories. */
export function areJobRolesConsistent(roles: JobRole[]): boolean {
  if (roles.length === 0) return false;
  const tradePartyRoles: JobRole[] = ['IMPORTER', 'EXPORTER'];
  const logisticsRoles: JobRole[] = ['FREIGHT_FORWARDER', 'WAREHOUSE_OPERATOR', 'CUSTOMS_BROKER'];
  const allTrade = roles.every(r => tradePartyRoles.includes(r));
  const allLogistics = roles.every(r => logisticsRoles.includes(r));
  return allTrade || allLogistics;
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
  | 'SHIPMENT_REASSIGNED';   // A shipment assignment was reassigned to you

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
