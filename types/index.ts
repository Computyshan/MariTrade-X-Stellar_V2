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

export interface User {
  id: string;
  email: string;
  fullName: string;
  fullAddress?: string;
  contactNumber?: string;
  userType: UserType;
  jobRole: JobRole;
  companyName?: string;
  stellarWallet?: string;
  kycStatus: KycStatus;
  kycDocumentUrl?: string;
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

export interface MilestoneEvent {
  id: string;
  shipmentId: string;
  loggedById: string;
  type: MilestoneType;
  description?: string;
  evidenceUrl: string; // required
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
  | 'SHIPMENT_STATUS_CHANGE' // Shipment status changed;

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
