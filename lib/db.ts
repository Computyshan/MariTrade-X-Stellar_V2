/**
 * lib/db.ts — MariTrade v2
 *
 * All data operations are backed by Supabase (PostgreSQL).
 * The exported `dbStore` object preserves the same interface that all API
 * routes already use, so no route-level changes are required.
 *
 * Column name mapping (snake_case DB ↔ camelCase TS):
 *   full_name          ↔ fullName
 *   full_address       ↔ fullAddress
 *   contact_number     ↔ contactNumber
 *   user_type          ↔ userType
 *   job_role           ↔ jobRole
 *   company_name       ↔ companyName
 *   stellar_wallet     ↔ stellarWallet
 *   kyc_status         ↔ kycStatus
 *   kyc_document_url   ↔ kycDocumentUrl
 *   created_at         ↔ createdAt
 *   updated_at         ↔ updatedAt
 *   reference_code     ↔ referenceCode
 *   importer_id        ↔ importerId
 *   exporter_id        ↔ exporterId
 *   origin_country     ↔ originCountry
 *   destination_port   ↔ destinationPort
 *   shipment_scope     ↔ shipmentScope
 *   total_value_usd    ↔ totalValueUSD
 *   escrow_status      ↔ escrowStatus
 *   escrow_amount_usd  ↔ escrowAmountUSD
 *   stellar_escrow_id  ↔ stellarEscrowId
 *   estimated_arrival  ↔ estimatedArrival
 *   shipment_id        ↔ shipmentId
 *   user_id            ↔ userId
 *   assigned_at        ↔ assignedAt
 *   is_completed       ↔ isCompleted
 *   logged_by_id       ↔ loggedById
 *   evidence_url       ↔ evidenceUrl
 *   occurred_at        ↔ occurredAt
 *   file_name          ↔ fileName
 *   file_url           ↔ fileUrl
 *   uploaded_by_id     ↔ uploadedById
 *   is_latest          ↔ isLatest
 *   thread_id          ↔ threadId
 *   cargo_description  ↔ cargoDescription
 *   current_counter_price_usd ↔ currentCounterPriceUSD
 *   currency           ↔ currency
 *   sender_id          ↔ senderId
 *   image_url          ↔ imageUrl
 *   is_unsent          ↔ isUnsent
 *   requester_id       ↔ requesterId
 *   receiver_id        ↔ receiverId
 *   folder_name        ↔ folderName
 *   created_by_user_id ↔ createdByUserId
 */

import { getSupabaseAdmin } from './supabase';
import {
  User,
  Shipment,
  ShipmentAssignment,
  PriorityMilestone,
  MilestoneEvent,
  ShipmentDocument,
  ChatThread,
  ChatParticipant,
  Message,
  ConnectionRequest,
  VaultFolder,
  AppNotification,
  ShipmentReceipt,
} from '../types';

// ─── Row → TypeScript mappers ─────────────────────────────────────────────────

function rowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    fullAddress: row.full_address ?? undefined,
    contactNumber: row.contact_number ?? undefined,
    userType: row.user_type,
    jobRole: row.job_role,
    companyName: row.company_name ?? undefined,
    stellarWallet: row.stellar_wallet ?? undefined,
    kycStatus: row.kyc_status,
    kycDocumentUrl: row.kyc_document_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function userToRow(user: User): any {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    full_address: user.fullAddress ?? null,
    contact_number: user.contactNumber ?? null,
    user_type: user.userType,
    job_role: user.jobRole,
    company_name: user.companyName ?? null,
    stellar_wallet: user.stellarWallet ?? null,
    kyc_status: user.kycStatus,
    kyc_document_url: user.kycDocumentUrl ?? null,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

function rowToShipment(row: any): Shipment {
  return {
    id: row.id,
    referenceCode: row.reference_code,
    importerId: row.importer_id,
    exporterId: row.exporter_id ?? undefined,
    description: row.description,
    originCountry: row.origin_country,
    destinationPort: row.destination_port,
    shipmentScope: row.shipment_scope,
    status: row.status,
    totalValueUSD: Number(row.total_value_usd),
    escrowStatus: row.escrow_status,
    escrowAmountUSD: row.escrow_amount_usd != null ? Number(row.escrow_amount_usd) : undefined,
    stellarEscrowId: row.stellar_escrow_id ?? undefined,
    estimatedArrival: row.estimated_arrival ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function shipmentToRow(s: Shipment): any {
  return {
    id: s.id,
    reference_code: s.referenceCode,
    importer_id: s.importerId,
    exporter_id: s.exporterId ?? null,
    description: s.description,
    origin_country: s.originCountry,
    destination_port: s.destinationPort,
    shipment_scope: s.shipmentScope,
    status: s.status,
    total_value_usd: s.totalValueUSD,
    escrow_status: s.escrowStatus,
    escrow_amount_usd: s.escrowAmountUSD ?? null,
    stellar_escrow_id: s.stellarEscrowId ?? null,
    estimated_arrival: s.estimatedArrival ?? null,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

function rowToAssignment(row: any): ShipmentAssignment {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    userId: row.user_id,
    assignedAt: row.assigned_at,
  };
}

function assignmentToRow(a: ShipmentAssignment): any {
  return {
    id: a.id,
    shipment_id: a.shipmentId,
    user_id: a.userId,
    assigned_at: a.assignedAt,
  };
}

function rowToPriorityMilestone(row: any): PriorityMilestone {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    type: row.type,
    isCompleted: row.is_completed,
  };
}

function priorityMilestoneToRow(pm: PriorityMilestone): any {
  return {
    id: pm.id,
    shipment_id: pm.shipmentId,
    type: pm.type,
    is_completed: pm.isCompleted,
  };
}

function rowToMilestoneEvent(row: any): MilestoneEvent {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    loggedById: row.logged_by_id,
    type: row.type,
    description: row.description ?? undefined,
    evidenceUrl: row.evidence_url,
    occurredAt: row.occurred_at,
    verified: row.verified,
  };
}

function milestoneEventToRow(me: MilestoneEvent): any {
  return {
    id: me.id,
    shipment_id: me.shipmentId,
    logged_by_id: me.loggedById,
    type: me.type,
    description: me.description ?? null,
    evidence_url: me.evidenceUrl,
    occurred_at: me.occurredAt,
    verified: me.verified,
  };
}

function rowToDocument(row: any): ShipmentDocument {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    uploadedById: row.uploaded_by_id,
    version: row.version,
    isLatest: row.is_latest,
    createdAt: row.created_at,
  };
}

function documentToRow(doc: ShipmentDocument): any {
  return {
    id: doc.id,
    shipment_id: doc.shipmentId,
    file_name: doc.fileName,
    file_url: doc.fileUrl,
    uploaded_by_id: doc.uploadedById,
    version: doc.version,
    is_latest: doc.isLatest,
    created_at: doc.createdAt,
  };
}

function rowToThread(row: any): ChatThread {
  return {
    id: row.id,
    status: row.status,
    shipmentId: row.shipment_id ?? undefined,
    cargoDescription: row.cargo_description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isGroup: row.is_group ?? false,
    groupName: row.group_name ?? undefined,
  };
}

function threadToRow(t: ChatThread): any {
  return {
    id: t.id,
    status: t.status,
    shipment_id: t.shipmentId ?? null,
    cargo_description: t.cargoDescription ?? null,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    is_group: t.isGroup ?? false,
    group_name: t.groupName ?? null,
  };
}

function rowToParticipant(row: any): ChatParticipant {
  return {
    id: row.id,
    threadId: row.thread_id,
    userId: row.user_id,
  };
}

function participantToRow(p: ChatParticipant): any {
  return {
    id: p.id,
    thread_id: p.threadId,
    user_id: p.userId,
  };
}

function rowToMessage(row: any): Message {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    content: row.content,
    createdAt: row.created_at,
    imageUrl: row.image_url ?? undefined,
    isUnsent: row.is_unsent ?? false,
  };
}

function messageToRow(msg: Message): any {
  return {
    id: msg.id,
    thread_id: msg.threadId,
    sender_id: msg.senderId,
    content: msg.content,
    created_at: msg.createdAt,
    image_url: msg.imageUrl ?? null,
    is_unsent: msg.isUnsent ?? false,
  };
}

function rowToConnection(row: any): ConnectionRequest {
  return {
    id: row.id,
    requesterId: row.requester_id,
    receiverId: row.receiver_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function connectionToRow(c: ConnectionRequest): any {
  return {
    id: c.id,
    requester_id: c.requesterId,
    receiver_id: c.receiverId,
    status: c.status,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

function rowToVaultFolder(row: any): VaultFolder {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    referenceCode: row.reference_code,
    folderName: row.folder_name,
    password: row.password,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  };
}

function vaultFolderToRow(vf: VaultFolder): any {
  return {
    id: vf.id,
    shipment_id: vf.shipmentId,
    reference_code: vf.referenceCode,
    folder_name: vf.folderName,
    password: vf.password,
    created_by_user_id: vf.createdByUserId,
    created_at: vf.createdAt,
  };
}

function rowToReceipt(row: any): ShipmentReceipt {
  return {
    id: row.id,
    threadId: row.thread_id,
    status: row.status,
    cargoDescription: row.cargo_description ?? undefined,
    shipmentScope: row.shipment_scope ?? undefined,
    estimatedArrival: row.estimated_arrival ?? undefined,
    importerContact: row.importer_contact ?? undefined,
    exporterContact: row.exporter_contact ?? undefined,
    originCountry: row.origin_country ?? undefined,
    originAddress: row.origin_address ?? undefined,
    originPort: row.origin_port ?? undefined,
    destCountry: row.dest_country ?? undefined,
    destAddress: row.dest_address ?? undefined,
    destinationPort: row.destination_port ?? undefined,
    invoiceCurrency: row.invoice_currency ?? 'USD',
    invoiceValue: row.invoice_value != null ? Number(row.invoice_value) : undefined,
    totalValueUSD: row.total_value_usd != null ? Number(row.total_value_usd) : undefined,
    hsCode: row.hs_code ?? undefined,
    isDangerousGoods: row.is_dangerous_goods ?? false,
    packageCount: row.package_count != null ? Number(row.package_count) : undefined,
    packagingType: row.packaging_type ?? undefined,
    grossWeight: row.gross_weight != null ? Number(row.gross_weight) : undefined,
    weightUnit: row.weight_unit ?? 'KG',
    lastEditedById: row.last_edited_by_id ?? undefined,
    finalizedById: row.finalized_by_id ?? undefined,
    finalizedAt: row.finalized_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function receiptToRow(r: ShipmentReceipt): any {
  return {
    id: r.id,
    thread_id: r.threadId,
    status: r.status,
    cargo_description: r.cargoDescription ?? null,
    shipment_scope: r.shipmentScope ?? null,
    estimated_arrival: r.estimatedArrival ?? null,
    importer_contact: r.importerContact ?? null,
    exporter_contact: r.exporterContact ?? null,
    origin_country: r.originCountry ?? null,
    origin_address: r.originAddress ?? null,
    origin_port: r.originPort ?? null,
    dest_country: r.destCountry ?? null,
    dest_address: r.destAddress ?? null,
    destination_port: r.destinationPort ?? null,
    invoice_currency: r.invoiceCurrency ?? 'USD',
    invoice_value: r.invoiceValue ?? null,
    total_value_usd: r.totalValueUSD ?? null,
    hs_code: r.hsCode ?? null,
    is_dangerous_goods: r.isDangerousGoods ?? false,
    package_count: r.packageCount ?? null,
    packaging_type: r.packagingType ?? null,
    gross_weight: r.grossWeight ?? null,
    weight_unit: r.weightUnit ?? 'KG',
    last_edited_by_id: r.lastEditedById ?? null,
    finalized_by_id: r.finalizedById ?? null,
    finalized_at: r.finalizedAt ?? null,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

// ─── Helper: throw on Supabase error ─────────────────────────────────────────

function assertNoError(error: any, context: string) {
  if (error) {
    console.error(`[dbStore] ${context}:`, error.message);
    throw new Error(error.message);
  }
}

// ─── dbStore — public API (async) ────────────────────────────────────────────

export const dbStore = {
  // ── Users ──────────────────────────────────────────────────────────────────

  getUsers: async (): Promise<User[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('users').select('*').order('created_at');
    assertNoError(error, 'getUsers');
    return (data ?? []).map(rowToUser);
  },

  getUserById: async (id: string): Promise<User | undefined> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('users').select('*').eq('id', id).maybeSingle();
    assertNoError(error, 'getUserById');
    return data ? rowToUser(data) : undefined;
  },

  getUserByEmail: async (email: string): Promise<User | undefined> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('users')
      .select('*')
      .ilike('email', email)
      .maybeSingle();
    assertNoError(error, 'getUserByEmail');
    return data ? rowToUser(data) : undefined;
  },

  saveUser: async (user: User): Promise<User> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('users')
      .upsert(userToRow(user), { onConflict: 'id' })
      .select()
      .single();
    assertNoError(error, 'saveUser');
    return rowToUser(data);
  },

  // ── Shipments ─────────────────────────────────────────────────────────────

  getShipments: async (): Promise<Shipment[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('shipments').select('*').order('created_at', { ascending: false });
    assertNoError(error, 'getShipments');
    return (data ?? []).map(rowToShipment);
  },

  getShipmentById: async (id: string): Promise<Shipment | undefined> => {
    // Accepts both the UUID id and the human-readable reference_code
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('shipments')
      .select('*')
      .or(`id.eq.${id},reference_code.eq.${id}`)
      .maybeSingle();
    assertNoError(error, 'getShipmentById');
    return data ? rowToShipment(data) : undefined;
  },

  saveShipment: async (shipment: Shipment): Promise<Shipment> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('shipments')
      .upsert(shipmentToRow(shipment), { onConflict: 'id' })
      .select()
      .single();
    assertNoError(error, 'saveShipment');
    return rowToShipment(data);
  },

  // ── Shipment Assignments ──────────────────────────────────────────────────

  getAssignments: async (): Promise<ShipmentAssignment[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('shipment_assignments').select('*');
    assertNoError(error, 'getAssignments');
    return (data ?? []).map(rowToAssignment);
  },

  getAssignmentsForShipment: async (shipmentId: string): Promise<ShipmentAssignment[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('shipment_assignments')
      .select('*')
      .eq('shipment_id', shipmentId);
    assertNoError(error, 'getAssignmentsForShipment');
    return (data ?? []).map(rowToAssignment);
  },

  getAssignmentsForUser: async (userId: string): Promise<ShipmentAssignment[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('shipment_assignments')
      .select('*')
      .eq('user_id', userId);
    assertNoError(error, 'getAssignmentsForUser');
    return (data ?? []).map(rowToAssignment);
  },

  saveAssignment: async (assignment: ShipmentAssignment): Promise<ShipmentAssignment> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('shipment_assignments')
      .upsert(assignmentToRow(assignment), { onConflict: 'shipment_id,user_id' })
      .select()
      .single();
    assertNoError(error, 'saveAssignment');
    return rowToAssignment(data);
  },

  // ── Priority Milestones ───────────────────────────────────────────────────

  getPriorityMilestones: async (shipmentId: string): Promise<PriorityMilestone[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('priority_milestones')
      .select('*')
      .eq('shipment_id', shipmentId);
    assertNoError(error, 'getPriorityMilestones');
    return (data ?? []).map(rowToPriorityMilestone);
  },

  savePriorityMilestones: async (milestones: PriorityMilestone[]): Promise<void> => {
    if (!milestones.length) return;
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('priority_milestones')
      .upsert(milestones.map(priorityMilestoneToRow), { onConflict: 'shipment_id,type' });
    assertNoError(error, 'savePriorityMilestones');
  },

  updatePriorityMilestoneStatus: async (
    shipmentId: string,
    type: string,
    isCompleted: boolean
  ): Promise<void> => {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('priority_milestones')
      .update({ is_completed: isCompleted })
      .eq('shipment_id', shipmentId)
      .eq('type', type);
    assertNoError(error, 'updatePriorityMilestoneStatus');
  },

  // ── Milestone Events ──────────────────────────────────────────────────────

  getMilestones: async (shipmentId: string): Promise<MilestoneEvent[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('milestone_events')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('occurred_at');
    assertNoError(error, 'getMilestones');
    return (data ?? []).map(rowToMilestoneEvent);
  },

  getAllMilestones: async (): Promise<MilestoneEvent[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('milestone_events')
      .select('*')
      .order('occurred_at');
    assertNoError(error, 'getAllMilestones');
    return (data ?? []).map(rowToMilestoneEvent);
  },

  saveMilestone: async (milestone: MilestoneEvent): Promise<MilestoneEvent> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('milestone_events')
      .insert(milestoneEventToRow(milestone))
      .select()
      .single();
    assertNoError(error, 'saveMilestone');
    return rowToMilestoneEvent(data);
  },

  // ── Shipment Documents ────────────────────────────────────────────────────

  getDocuments: async (shipmentId?: string): Promise<ShipmentDocument[]> => {
    const admin = getSupabaseAdmin();
    let query = admin.from('shipment_documents').select('*').order('created_at');
    if (shipmentId) {
      query = query.eq('shipment_id', shipmentId);
    }
    const { data, error } = await query;
    assertNoError(error, 'getDocuments');
    return (data ?? []).map(rowToDocument);
  },

  saveDocument: async (doc: ShipmentDocument): Promise<ShipmentDocument> => {
    const admin = getSupabaseAdmin();
    // Mark older versions of the same file as not-latest before inserting
    if (doc.isLatest) {
      await admin
        .from('shipment_documents')
        .update({ is_latest: false })
        .eq('shipment_id', doc.shipmentId)
        .eq('file_name', doc.fileName);
    }
    const { data, error } = await admin
      .from('shipment_documents')
      .insert(documentToRow(doc))
      .select()
      .single();
    assertNoError(error, 'saveDocument');
    return rowToDocument(data);
  },

  // ── Chat Threads ──────────────────────────────────────────────────────────

  getThreads: async (): Promise<ChatThread[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('chat_threads')
      .select('*')
      .order('updated_at', { ascending: false });
    assertNoError(error, 'getThreads');
    return (data ?? []).map(rowToThread);
  },

  getThreadById: async (id: string): Promise<ChatThread | undefined> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('chat_threads')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    assertNoError(error, 'getThreadById');
    return data ? rowToThread(data) : undefined;
  },

  saveThread: async (thread: ChatThread): Promise<ChatThread> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('chat_threads')
      .upsert(threadToRow(thread), { onConflict: 'id' })
      .select()
      .single();
    assertNoError(error, 'saveThread');
    return rowToThread(data);
  },

  // ── Chat Participants ─────────────────────────────────────────────────────

  getParticipants: async (): Promise<ChatParticipant[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('chat_participants').select('*');
    assertNoError(error, 'getParticipants');
    return (data ?? []).map(rowToParticipant);
  },

  getParticipantsForThread: async (threadId: string): Promise<ChatParticipant[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('chat_participants')
      .select('*')
      .eq('thread_id', threadId);
    assertNoError(error, 'getParticipantsForThread');
    return (data ?? []).map(rowToParticipant);
  },

  saveParticipant: async (participant: ChatParticipant): Promise<ChatParticipant> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('chat_participants')
      .upsert(participantToRow(participant), { onConflict: 'thread_id,user_id' })
      .select()
      .single();
    assertNoError(error, 'saveParticipant');
    return rowToParticipant(data);
  },

  // ── Shipment Receipts (Escrow & Offers planner) ────────────────────────────

  getReceiptByThreadId: async (threadId: string): Promise<ShipmentReceipt | undefined> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('shipment_receipts')
      .select('*')
      .eq('thread_id', threadId)
      .maybeSingle();
    assertNoError(error, 'getReceiptByThreadId');
    return data ? rowToReceipt(data) : undefined;
  },

  saveReceipt: async (receipt: ShipmentReceipt): Promise<ShipmentReceipt> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('shipment_receipts')
      .upsert(receiptToRow(receipt), { onConflict: 'id' })
      .select()
      .single();
    assertNoError(error, 'saveReceipt');
    return rowToReceipt(data);
  },

  /** Finalized receipts from any thread the given user participates in — used to
   *  populate the "Pick from a Receipt" picker on the Create Shipment page. */
  getFinalizedReceiptsForUser: async (userId: string): Promise<ShipmentReceipt[]> => {
    const admin = getSupabaseAdmin();
    const { data: participantRows, error: pErr } = await admin
      .from('chat_participants')
      .select('thread_id')
      .eq('user_id', userId);
    assertNoError(pErr, 'getFinalizedReceiptsForUser:participants');
    const threadIds = (participantRows ?? []).map((r: any) => r.thread_id);
    if (threadIds.length === 0) return [];

    const { data, error } = await admin
      .from('shipment_receipts')
      .select('*')
      .in('thread_id', threadIds)
      .eq('status', 'FINALIZED')
      .order('finalized_at', { ascending: false });
    assertNoError(error, 'getFinalizedReceiptsForUser');
    return (data ?? []).map(rowToReceipt);
  },

  // ── Messages ──────────────────────────────────────────────────────────────

  getMessages: async (threadId?: string): Promise<Message[]> => {
    const admin = getSupabaseAdmin();
    let query = admin.from('messages').select('*').order('created_at');
    if (threadId) {
      query = query.eq('thread_id', threadId);
    }
    const { data, error } = await query;
    assertNoError(error, 'getMessages');
    return (data ?? []).map(rowToMessage);
  },

  saveMessage: async (msg: Message): Promise<Message> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('messages')
      .upsert(messageToRow(msg), { onConflict: 'id' })
      .select()
      .single();
    assertNoError(error, 'saveMessage');
    return rowToMessage(data);
  },

  unsendMessage: async (messageId: string): Promise<void> => {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('messages')
      .update({ is_unsent: true, content: 'This message was unsent.' })
      .eq('id', messageId);
    assertNoError(error, 'unsendMessage');
  },

  /** #8 — Batch fetch the most recent message per thread (fixes N+1 in GET /threads) */
  getLastMessagePerThread: async (threadIds: string[]): Promise<Record<string, Message>> => {
    if (!threadIds.length) return {};
    const admin = getSupabaseAdmin();
    // Fetch all messages for these threads ordered oldest→newest, then keep the last per thread
    const { data, error } = await admin
      .from('messages')
      .select('*')
      .in('thread_id', threadIds)
      .order('created_at', { ascending: true });
    assertNoError(error, 'getLastMessagePerThread');
    const result: Record<string, Message> = {};
    for (const row of data ?? []) {
      result[row.thread_id] = rowToMessage(row);
    }
    return result;
  },

  // ── BOC Document Vault Folders ────────────────────────────────────────────

  getVaultFolders: async (): Promise<VaultFolder[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('vault_folders')
      .select('*')
      .order('created_at', { ascending: false });
    assertNoError(error, 'getVaultFolders');
    return (data ?? []).map(rowToVaultFolder);
  },

  getVaultFolderById: async (id: string): Promise<VaultFolder | undefined> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('vault_folders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    assertNoError(error, 'getVaultFolderById');
    return data ? rowToVaultFolder(data) : undefined;
  },

  getVaultFolderByShipmentId: async (shipmentId: string): Promise<VaultFolder | undefined> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('vault_folders')
      .select('*')
      .eq('shipment_id', shipmentId)
      .maybeSingle();
    assertNoError(error, 'getVaultFolderByShipmentId');
    return data ? rowToVaultFolder(data) : undefined;
  },

  saveVaultFolder: async (folder: VaultFolder): Promise<VaultFolder> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('vault_folders')
      .upsert(vaultFolderToRow(folder), { onConflict: 'id' })
      .select()
      .single();
    assertNoError(error, 'saveVaultFolder');
    return rowToVaultFolder(data);
  },

  // ── B2B Vendor Network (Connection Requests) ──────────────────────────────

  getConnectionRequests: async (): Promise<ConnectionRequest[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('connection_requests').select('*');
    assertNoError(error, 'getConnectionRequests');
    return (data ?? []).map(rowToConnection);
  },

  getConnectionRequestById: async (id: string): Promise<ConnectionRequest | undefined> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('connection_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    assertNoError(error, 'getConnectionRequestById');
    return data ? rowToConnection(data) : undefined;
  },

  /** All requests where userId is either requester or receiver */
  getConnectionRequestsForUser: async (userId: string): Promise<ConnectionRequest[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('connection_requests')
      .select('*')
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
    assertNoError(error, 'getConnectionRequestsForUser');
    return (data ?? []).map(rowToConnection);
  },

  /** IDs of vendors in the Importer's Trusted Network (status === ACCEPTED) */
  getTrustedVendorIds: async (importerId: string): Promise<string[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('connection_requests')
      .select('receiver_id')
      .eq('requester_id', importerId)
      .eq('status', 'ACCEPTED');
    assertNoError(error, 'getTrustedVendorIds');
    return (data ?? []).map((r: any) => r.receiver_id);
  },

  saveConnectionRequest: async (conn: ConnectionRequest): Promise<ConnectionRequest> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('connection_requests')
      .upsert(connectionToRow(conn), { onConflict: 'id' })
      .select()
      .single();
    assertNoError(error, 'saveConnectionRequest');
    return rowToConnection(data);
  },

  // ── Notifications ─────────────────────────────────────────────────────────

  getNotificationsForUser: async (userId: string): Promise<AppNotification[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    assertNoError(error, 'getNotificationsForUser');
    return (data ?? []).map((row: any): AppNotification => ({
      id:        row.id,
      userId:    row.user_id,
      type:      row.type,
      title:     row.title,
      body:      row.body,
      linkHref:  row.link_href ?? undefined,
      isRead:    row.is_read,
      createdAt: row.created_at,
    }));
  },

  saveNotification: async (n: AppNotification): Promise<AppNotification> => {
    const row = {
      id:         n.id,
      user_id:    n.userId,
      type:       n.type,
      title:      n.title,
      body:       n.body,
      link_href:  n.linkHref ?? null,
      is_read:    n.isRead,
      created_at: n.createdAt,
    };
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('notifications')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();
    assertNoError(error, 'saveNotification');
    return {
      id:        data.id,
      userId:    data.user_id,
      type:      data.type,
      title:     data.title,
      body:      data.body,
      linkHref:  data.link_href ?? undefined,
      isRead:    data.is_read,
      createdAt: data.created_at,
    };
  },

  markNotificationRead: async (notificationId: string): Promise<void> => {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    assertNoError(error, 'markNotificationRead');
  },

  markAllNotificationsRead: async (userId: string): Promise<void> => {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    assertNoError(error, 'markAllNotificationsRead');
  },
};
