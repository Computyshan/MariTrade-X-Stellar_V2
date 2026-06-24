import { create } from 'zustand';
import { User, JobRole, TradePartyRole, LogisticsChainRole } from '../types';

interface UserSessionState {
  currentUser: User;
  allUsers: User[];
  setCurrentUser: (user: User) => void;
  updateUserKyc: (kycStatus: User['kycStatus'], jobRole?: JobRole, companyName?: string) => void;
  resetSession: () => void;
}

// 5 seed users: 2 Trade Party + 3 Logistics Chain
const STATIC_USERS: User[] = [
  // ─── Trade Party ───
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
  // ─── Logistics Chain ───
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

export const useUserSession = create<UserSessionState>((set) => ({
  currentUser: STATIC_USERS[0], // Default logged-in user is Juan Importer
  allUsers: STATIC_USERS,
  setCurrentUser: (user) => set({ currentUser: user }),
  updateUserKyc: (kycStatus, jobRole, companyName) => set((state) => {
    const tradePartyRoles: JobRole[] = ['IMPORTER', 'EXPORTER'];
    const updatedUser = { 
      ...state.currentUser, 
      kycStatus,
      ...(jobRole && { jobRole }),
      ...(companyName && { companyName }),
      userType: jobRole && tradePartyRoles.includes(jobRole)
        ? 'TRADE_PARTY' as const 
        : 'LOGISTICS_CHAIN' as const
    };
    return {
      currentUser: updatedUser,
      allUsers: state.allUsers.map((u) => u.id === state.currentUser.id ? updatedUser : u)
    };
  }),
  resetSession: () => set({ currentUser: STATIC_USERS[0] })
}));
