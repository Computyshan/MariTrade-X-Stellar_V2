import * as fs from 'fs';
import * as path from 'path';
import { 
  User, 
  Shipment, 
  ShipmentAssignment, 
  PriorityMilestone, 
  MilestoneEvent, 
  ShipmentDocument, 
  ChatThread, 
  ChatParticipant, 
  Message 
} from '../types';

interface SchemaStore {
  users: User[];
  shipments: Shipment[];
  assignments: ShipmentAssignment[];
  priorityMilestones: PriorityMilestone[];
  milestones: MilestoneEvent[];
  documents: ShipmentDocument[];
  threads: ChatThread[];
  participants: ChatParticipant[];
  messages: Message[];
  _chatSeedCleared?: boolean;
}

const STORAGE_PATH = '/tmp/maritrade_v2_db.json';

const INITIAL_USERS: User[] = [
  // ─── Trade Party (2) ───
  {
    id: 'shaun-importer-id',
    email: 'shaun@siga.ph',
    fullName: 'Tyshaun Louis L. Siga',
    fullAddress: 'Mintal, Davao, Philippines',
    contactNumber: '+639171234567',
    userType: 'TRADE_PARTY',
    jobRole: 'IMPORTER',
    companyName: 'Shaun Trading',
    kycStatus: 'VERIFIED',
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-01-10T10:00:00Z'
  },
  {
    id: 'dav4d-exporter-id',
    email: 'dav4d@ngalogistics.jp',
    fullName: 'Ryan David',
    fullAddress: 'Japanacan, Tokyo, Japan',
    contactNumber: '+819012345678',
    userType: 'TRADE_PARTY',
    jobRole: 'EXPORTER',
    companyName: 'Random ass Logistics Corp',
    kycStatus: 'VERIFIED',
    createdAt: '2026-01-11T11:00:00Z',
    updatedAt: '2026-01-11T11:00:00Z'
  },
  // ─── Logistics Chain (3) ───
  {
    id: 'tristan-forwarder-id',
    email: 'trst@domingsforwarding.ph',
    fullName: 'Tristan Dominiga',
    fullAddress: 'Atlantis, Surigao del Norte, Philippines',
    contactNumber: '+639178881122',
    userType: 'LOGISTICS_CHAIN',
    jobRole: 'FREIGHT_FORWARDER',
    companyName: 'Domingo Global Forwarding',
    kycStatus: 'VERIFIED',
    createdAt: '2026-01-13T08:00:00Z',
    updatedAt: '2026-01-13T08:00:00Z'
  },
  {
    id: 'quinn-warehouse-id',
    email: 'quinn@warehouse.ph',
    fullName: 'Quinn Reboqiuo',
    fullAddress: 'Dasmariñas, Cavite, Philippines',
    contactNumber: '+639167778899',
    userType: 'LOGISTICS_CHAIN',
    jobRole: 'WAREHOUSE_OPERATOR',
    companyName: 'Metro Manila Distribution Center',
    kycStatus: 'VERIFIED',
    createdAt: '2026-01-15T11:00:00Z',
    updatedAt: '2026-01-15T11:00:00Z'
  },
  {
    id: 'charles-broker-id',
    email: 'selrach@solomonbrokerage.ph',
    fullName: 'Charles Solomon',
    fullAddress: 'NGAVill, Cagayan De Oro, Philippines',
    contactNumber: '+639189876543',
    userType: 'LOGISTICS_CHAIN',
    jobRole: 'CUSTOMS_BROKER',
    companyName: 'Selcrach Customs Brokerage',
    kycStatus: 'VERIFIED',
    createdAt: '2026-01-12T09:00:00Z',
    updatedAt: '2026-01-12T09:00:00Z'
  },
];

const INITIAL_SHIPMENTS: Shipment[] = [
  {
    id: 'shipment-tokyo-manila-1',
    referenceCode: 'MT-2026-00341',
    importerId: 'shaun-importer-id',
    exporterId: 'dav4d-exporter-id',
    description: 'Industrial Electric Motors and Replacement Gears',
    originCountry: 'Japan (Tokyo)',
    destinationPort: 'Port of Manila (MICP)',
    shipmentScope: 'OVERSEAS',
    status: 'IN_TRANSIT',
    totalValueUSD: 45000,
    escrowStatus: 'FUNDED',
    escrowAmountUSD: 45000,
    stellarEscrowId: 'GCE6...KCSU_ESCROW_ESC341',
    estimatedArrival: '2026-06-28T18:00:00Z',
    createdAt: '2026-05-15T08:24:00Z',
    updatedAt: '2026-06-18T10:15:00Z'
  },
  {
    id: 'shipment-zambo-manila-2',
    referenceCode: 'MT-2026-00122',
    importerId: 'shaun-importer-id',
    exporterId: 'shaun-importer-id', // Local self-trade or custom merchant
    description: 'Fresh Mindanao Canned Sardines Batch 22B',
    originCountry: 'Philippines (Zamboanga)',
    destinationPort: 'Manila North Harbor',
    shipmentScope: 'NATIONWIDE',
    status: 'DELIVERED',
    totalValueUSD: 12500,
    escrowStatus: 'RELEASED',
    escrowAmountUSD: 12500,
    stellarEscrowId: 'GDE3...JKLD_ESCROW_ESC122',
    estimatedArrival: '2026-06-05T12:00:00Z',
    createdAt: '2026-05-10T09:00:00Z',
    updatedAt: '2026-06-05T15:30:00Z'
  }
];

const INITIAL_ASSIGNMENTS: ShipmentAssignment[] = [
  {
    id: 'assign-1',
    shipmentId: 'shipment-tokyo-manila-1',
    userId: 'charles-broker-id',
    assignedAt: '2026-05-16T10:00:00Z'
  },
  {
    id: 'assign-2',
    shipmentId: 'shipment-tokyo-manila-1',
    userId: 'tristan-forwarder-id',
    assignedAt: '2026-05-16T09:30:00Z'
  },
  {
    id: 'assign-3',
    shipmentId: 'shipment-tokyo-manila-1',
    userId: 'quinn-warehouse-id',
    assignedAt: '2026-05-16T11:00:00Z'
  },
  {
    id: 'assign-4',
    shipmentId: 'shipment-tokyo-manila-1',
    userId: 'charles-broker-id',
    assignedAt: '2026-05-16T10:00:00Z'
  }
];

const INITIAL_PRIORITY_MILESTONES: PriorityMilestone[] = [
  {
    id: 'pm-1',
    shipmentId: 'shipment-tokyo-manila-1',
    type: 'CUSTOMS_CLEARANCE_APPROVED',
    isCompleted: false
  },
  {
    id: 'pm-2',
    shipmentId: 'shipment-tokyo-manila-1',
    type: 'DELIVERED_AND_SIGNED_OFF',
    isCompleted: false
  },
  // Completed ones for shipment 2
  {
    id: 'pm-3',
    shipmentId: 'shipment-zambo-manila-2',
    type: 'CUSTOMS_CLEARANCE_APPROVED',
    isCompleted: true
  },
  {
    id: 'pm-4',
    shipmentId: 'shipment-zambo-manila-2',
    type: 'DELIVERED_AND_SIGNED_OFF',
    isCompleted: true
  }
];

const INITIAL_MILESTONES: MilestoneEvent[] = [
  // Shipment 1 events
  {
    id: 'me-1',
    shipmentId: 'shipment-tokyo-manila-1',
    loggedById: 'tristan-forwarder-id',
    type: 'BOOKING_CONFIRMED',
    description: 'Vessel spot booked on Maersk Tokyo Express.',
    evidenceUrl: 'https://picsum.photos/seed/booking/800/600',
    occurredAt: '2026-05-18T14:30:00Z',
    verified: true
  },
  {
    id: 'me-2',
    shipmentId: 'shipment-tokyo-manila-1',
    loggedById: 'tristan-forwarder-id',
    type: 'SPACE_ON_VESSEL_SECURED',
    description: 'Container sealed and space locked on bay 3A.',
    evidenceUrl: 'https://picsum.photos/seed/seal/800/600',
    occurredAt: '2026-05-20T11:00:00Z',
    verified: true
  },
  {
    id: 'me-3',
    shipmentId: 'shipment-tokyo-manila-1',
    loggedById: 'charles-broker-id',
    type: 'BOC_ENTRY_FILED',
    description: 'BOC single administrative document (SAD) logged at MICP.',
    evidenceUrl: 'https://picsum.photos/seed/boc/800/600',
    occurredAt: '2026-06-18T10:15:00Z',
    verified: true
  },
  // Shipment 2 events (fully delivered timeline)
  {
    id: 'me-4',
    shipmentId: 'shipment-zambo-manila-2',
    loggedById: 'tristan-forwarder-id',
    type: 'BOOKING_CONFIRMED',
    description: 'Direct sea cargo booked by forwarder.',
    evidenceUrl: 'https://picsum.photos/seed/boat/800/600',
    occurredAt: '2026-05-12T08:00:00Z',
    verified: true
  },
  {
    id: 'me-5',
    shipmentId: 'shipment-zambo-manila-2',
    loggedById: 'charles-broker-id',
    type: 'CUSTOMS_CLEARANCE_APPROVED',
    description: 'Zamboanga customs duty clearance verified and tax receipt issued.',
    evidenceUrl: 'https://picsum.photos/seed/receipt/800/600',
    occurredAt: '2026-05-28T16:00:00Z',
    verified: true
  },
  {
    id: 'me-6',
    shipmentId: 'shipment-zambo-manila-2',
    loggedById: 'tristan-forwarder-id',
    type: 'DELIVERED_AND_SIGNED_OFF',
    description: 'Sardine crates delivered safely to Binondo Storage Hall. Signed off by importer.',
    evidenceUrl: 'https://picsum.photos/seed/storage/800/600',
    occurredAt: '2026-06-05T15:30:00Z',
    verified: true
  }
];

const INITIAL_DOCUMENTS: ShipmentDocument[] = [
  {
    id: 'doc-1',
    shipmentId: 'shipment-tokyo-manila-1',
    fileName: 'BillOfLading_MT341_Maersk.pdf',
    fileUrl: 'https://picsum.photos/seed/doc1/800/600',
    uploadedById: 'tristan-forwarder-id',
    version: 1,
    isLatest: true,
    createdAt: '2026-05-18T14:40:00Z'
  },
  {
    id: 'doc-2',
    shipmentId: 'shipment-tokyo-manila-1',
    fileName: 'BOC_Import_Declaration_SAD_Signed.pdf',
    fileUrl: 'https://picsum.photos/seed/doc2/800/600',
    uploadedById: 'charles-broker-id',
    version: 1,
    isLatest: true,
    createdAt: '2026-06-18T10:20:00Z'
  },
  {
    id: 'doc-3',
    shipmentId: 'shipment-tokyo-manila-1',
    fileName: 'Amended_Commercial_Invoice_Tanaka.pdf',
    fileUrl: 'https://picsum.photos/seed/doc3/800/600',
    uploadedById: 'dav4d-exporter-id',
    version: 2,
    isLatest: true,
    createdAt: '2026-06-19T13:00:00Z'
  },
  {
    id: 'doc-4',
    shipmentId: 'shipment-zambo-manila-2',
    fileName: 'Domestic_Cargo_Release_Slip.pdf',
    fileUrl: 'https://picsum.photos/seed/doc4/800/600',
    uploadedById: 'shaun-importer-id',
    version: 1,
    isLatest: true,
    createdAt: '2026-05-14T09:30:00Z'
  }
];

const INITIAL_THREADS: ChatThread[] = [];
const INITIAL_PARTICIPANTS: ChatParticipant[] = [];
const INITIAL_MESSAGES: Message[] = [];

const IN_MEMORY_STORE: SchemaStore = {
  users: INITIAL_USERS,
  shipments: INITIAL_SHIPMENTS,
  assignments: INITIAL_ASSIGNMENTS,
  priorityMilestones: INITIAL_PRIORITY_MILESTONES,
  milestones: INITIAL_MILESTONES,
  documents: INITIAL_DOCUMENTS,
  threads: INITIAL_THREADS,
  participants: INITIAL_PARTICIPANTS,
  messages: INITIAL_MESSAGES
};

function readDb(): SchemaStore {
  try {
    if (typeof window === 'undefined') {
      if (fs.existsSync(STORAGE_PATH)) {
        const fileContent = fs.readFileSync(STORAGE_PATH, 'utf-8').trim();
        if (!fileContent) {
          // File is empty, write initial memory store
          fs.writeFileSync(STORAGE_PATH, JSON.stringify(IN_MEMORY_STORE, null, 2), 'utf-8');
          return IN_MEMORY_STORE;
        }
        try {
          const parsed = JSON.parse(fileContent);
          if (parsed && typeof parsed === 'object') {
            // Check if the new importer profile exists, otherwise force reset/refresh matching your manual code changes
            // Force reset if old roles (TRUCKER, SHIPPING_LINE_CAPTAIN, PORT_AUTHORITY_OFFICER) are still present
            const hasLegacyRoles = Array.isArray(parsed.users) && parsed.users.some(
              (u: any) => ['TRUCKER', 'SHIPPING_LINE_CAPTAIN', 'PORT_AUTHORITY_OFFICER', 'COMPANY_OWNER', 'TRADER'].includes(u.jobRole)
            );
            const hasNewProfiles = Array.isArray(parsed.users) && parsed.users.some((u: any) => u.id === 'shaun-importer-id') && !hasLegacyRoles;
            if (!hasNewProfiles) {
              fs.writeFileSync(STORAGE_PATH, JSON.stringify(IN_MEMORY_STORE, null, 2), 'utf-8');
              return IN_MEMORY_STORE;
            }

            const sanitized: SchemaStore = {
              users: Array.isArray(parsed.users) ? parsed.users : IN_MEMORY_STORE.users,
              shipments: Array.isArray(parsed.shipments) ? parsed.shipments : IN_MEMORY_STORE.shipments,
              assignments: Array.isArray(parsed.assignments) ? parsed.assignments : IN_MEMORY_STORE.assignments,
              priorityMilestones: Array.isArray(parsed.priorityMilestones) ? parsed.priorityMilestones : IN_MEMORY_STORE.priorityMilestones,
              milestones: Array.isArray(parsed.milestones) ? parsed.milestones : IN_MEMORY_STORE.milestones,
              documents: Array.isArray(parsed.documents) ? parsed.documents : IN_MEMORY_STORE.documents,
              threads: Array.isArray(parsed.threads) ? parsed.threads : IN_MEMORY_STORE.threads,
              participants: Array.isArray(parsed.participants) ? parsed.participants : IN_MEMORY_STORE.participants,
              messages: Array.isArray(parsed.messages) ? parsed.messages : IN_MEMORY_STORE.messages,
              _chatSeedCleared: parsed._chatSeedCleared === true,
            };

            if (!sanitized._chatSeedCleared) {
              sanitized.threads = [];
              sanitized.participants = [];
              sanitized.messages = [];
              sanitized._chatSeedCleared = true;
              fs.writeFileSync(STORAGE_PATH, JSON.stringify(sanitized, null, 2), 'utf-8');
            }

            return sanitized;
          }
        } catch {
          // JSON parsing failed, heal file with memory content
          fs.writeFileSync(STORAGE_PATH, JSON.stringify(IN_MEMORY_STORE, null, 2), 'utf-8');
          return IN_MEMORY_STORE;
        }
      } else {
        // Populate initial
        fs.writeFileSync(STORAGE_PATH, JSON.stringify(IN_MEMORY_STORE, null, 2), 'utf-8');
        return IN_MEMORY_STORE;
      }
    }
  } catch (err) {
    console.error('Error reading DB, using memory:', err);
  }
  return IN_MEMORY_STORE;
}

function writeDb(store: SchemaStore) {
  try {
    if (typeof window === 'undefined') {
      const parentDir = path.dirname(STORAGE_PATH);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(STORAGE_PATH, JSON.stringify(store, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error writing DB:', err);
  }
  // Keep memory synchronized too
  IN_MEMORY_STORE.users = store.users;
  IN_MEMORY_STORE.shipments = store.shipments;
  IN_MEMORY_STORE.assignments = store.assignments;
  IN_MEMORY_STORE.priorityMilestones = store.priorityMilestones;
  IN_MEMORY_STORE.milestones = store.milestones;
  IN_MEMORY_STORE.documents = store.documents;
  IN_MEMORY_STORE.threads = store.threads;
  IN_MEMORY_STORE.participants = store.participants;
  IN_MEMORY_STORE.messages = store.messages;
}

export const dbStore = {
  getUsers: () => readDb().users,
  getUserById: (id: string) => readDb().users.find(u => u.id === id),
  saveUser: (user: User) => {
    const db = readDb();
    const idx = db.users.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      db.users[idx] = user;
    } else {
      db.users.push(user);
    }
    writeDb(db);
    return user;
  },

  getShipments: () => readDb().shipments,
  getShipmentById: (id: string) => readDb().shipments.find(s => s.id === id || s.referenceCode === id),
  saveShipment: (shipment: Shipment) => {
    const db = readDb();
    const idx = db.shipments.findIndex(s => s.id === shipment.id);
    if (idx !== -1) {
      db.shipments[idx] = shipment;
    } else {
      db.shipments.push(shipment);
    }
    writeDb(db);
    return shipment;
  },

  getAssignments: () => readDb().assignments,
  getAssignmentsForShipment: (shipmentId: string) => readDb().assignments.filter(a => a.shipmentId === shipmentId),
  getAssignmentsForUser: (userId: string) => readDb().assignments.filter(a => a.userId === userId),
  saveAssignment: (assignment: ShipmentAssignment) => {
    const db = readDb();
    db.assignments.push(assignment);
    writeDb(db);
    return assignment;
  },

  getPriorityMilestones: (shipmentId: string) => readDb().priorityMilestones.filter(pm => pm.shipmentId === shipmentId),
  savePriorityMilestones: (milestones: PriorityMilestone[]) => {
    const db = readDb();
    // Remove stale ones for these shipments
    const shipmentIds = Array.from(new Set(milestones.map(m => m.shipmentId)));
    db.priorityMilestones = db.priorityMilestones.filter(pm => !shipmentIds.includes(pm.shipmentId));
    db.priorityMilestones.push(...milestones);
    writeDb(db);
  },
  updatePriorityMilestoneStatus: (shipmentId: string, type: string, isCompleted: boolean) => {
    const db = readDb();
    db.priorityMilestones = db.priorityMilestones.map(pm => {
      if (pm.shipmentId === shipmentId && pm.type === type) {
        return { ...pm, isCompleted };
      }
      return pm;
    });
    writeDb(db);
  },

  getMilestones: (shipmentId: string) => readDb().milestones.filter(m => m.shipmentId === shipmentId),
  getAllMilestones: () => readDb().milestones,
  saveMilestone: (milestone: MilestoneEvent) => {
    const db = readDb();
    db.milestones.push(milestone);
    writeDb(db);
    return milestone;
  },

  getDocuments: (shipmentId?: string) => {
    const docs = readDb().documents;
    if (shipmentId) {
      return docs.filter(d => d.shipmentId === shipmentId);
    }
    return docs;
  },
  saveDocument: (doc: ShipmentDocument) => {
    const db = readDb();
    // If we upload a new version, mark others as not latest
    if (doc.isLatest) {
      db.documents = db.documents.map(d => {
        if (d.shipmentId === doc.shipmentId && d.fileName === doc.fileName) {
          return { ...d, isLatest: false };
        }
        return d;
      });
    }
    db.documents.push(doc);
    writeDb(db);
    return doc;
  },

  getThreads: () => readDb().threads,
  getThreadById: (id: string) => readDb().threads.find(t => t.id === id),
  saveThread: (thread: ChatThread) => {
    const db = readDb();
    const idx = db.threads.findIndex(t => t.id === thread.id);
    if (idx !== -1) {
      db.threads[idx] = thread;
    } else {
      db.threads.push(thread);
    }
    writeDb(db);
    return thread;
  },

  getParticipants: () => readDb().participants,
  getParticipantsForThread: (threadId: string) => readDb().participants.filter(p => p.threadId === threadId),
  saveParticipant: (participant: ChatParticipant) => {
    const db = readDb();
    db.participants.push(participant);
    writeDb(db);
    return participant;
  },

  getMessages: (threadId?: string) => {
    const msgs = readDb().messages;
    if (threadId) {
      return msgs.filter(m => m.threadId === threadId).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return msgs;
  },
  saveMessage: (msg: Message) => {
    const db = readDb();
    const idx = db.messages.findIndex(m => m.id === msg.id);
    if (idx !== -1) {
      db.messages[idx] = msg;
    } else {
      db.messages.push(msg);
    }
    writeDb(db);
    return msg;
  },
  unsendMessage: (messageId: string) => {
    const db = readDb();
    db.messages = db.messages.map(m => {
      if (m.id === messageId) {
        return { ...m, isUnsent: true, content: 'This message was unsent.' };
      }
      return m;
    });
    writeDb(db);
  }
};
