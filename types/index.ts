export type UserType = 'TRADE_PARTY' | 'LOGISTICS_CHAIN';

export type JobRole =
  | 'IMPORTER'
  | 'EXPORTER'
  | 'COMPANY_OWNER'
  | 'TRADER'
  | 'FREIGHT_FORWARDER'
  | 'SHIPPING_LINE_CAPTAIN'
  | 'CUSTOMS_BROKER'
  | 'WAREHOUSE_OPERATOR'
  | 'PORT_AUTHORITY_OFFICER'
  | 'TRUCKER';

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

export type ChatThreadStatus = 'OPEN' | 'DEAL_AGREED' | 'COUNTER_OFFER' | 'CLOSED';

export type MilestoneType =
  // Freight Forwarder
  | 'BOOKING_CONFIRMED'
  | 'DOCUMENTS_SUBMITTED_TO_CARRIER'
  | 'CARGO_READY_FOR_COLLECTION'
  | 'SPACE_ON_VESSEL_SECURED'
  // Shipping Line / Captain
  | 'BILL_OF_LADING_ISSUED'
  | 'CONTAINER_LOADED_ON_VESSEL'
  | 'VESSEL_DEPARTED_ORIGIN'
  | 'VESSEL_ARRIVED_DESTINATION'
  | 'CONTAINER_OFFLOADED'
  // Customs Broker
  | 'BOC_ENTRY_FILED'
  | 'DUTIES_AND_TAXES_PAID'
  | 'CUSTOMS_EXAMINATION_REQUESTED'
  | 'CUSTOMS_CLEARANCE_APPROVED'
  | 'CARGO_RELEASED_FOR_PICKUP'
  // Warehouse Operator
  | 'CARGO_RECEIVED_AT_WAREHOUSE'
  | 'CARGO_INSPECTED_AND_PACKED'
  | 'CARGO_STAGED_FOR_PICKUP'
  | 'CARGO_HANDED_OFF_TO_CARRIER'
  | 'INCOMING_CARGO_STORED'
  // Port Authority
  | 'VESSEL_CLEARED_TO_DEPART'
  | 'CONTAINER_GATED_OUT_ORIGIN'
  | 'VESSEL_ARRIVED_AT_BERTH'
  | 'CONTAINER_GATED_IN_DESTINATION'
  | 'PORT_HOLD_PLACED_OR_LIFTED'
  // Trucker
  | 'CARGO_PICKED_UP_FROM_PORT'
  | 'IN_TRANSIT_TO_DESTINATION'
  | 'ARRIVED_AT_DELIVERY_ADDRESS'
  | 'DELIVERED_AND_SIGNED_OFF'
  | 'FAILED_DELIVERY_ATTEMPT';

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
  bankDetails?: string;
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
  currentCounterPriceUSD?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatParticipant {
  id: string;
  threadId: string;
  userId: string;
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
