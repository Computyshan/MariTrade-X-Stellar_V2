'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import {
  FolderLock,
  FileText,
  Lock,
  ShieldCheck,
  Search,
  X,
  Globe,
  Clock,
  Key,
  ChevronRight,
} from 'lucide-react';
import { ShipmentScope, ShipmentStatus } from '@/types';
import { canAccessBOCDocuments } from '@/lib/permissions/documents';
import { motion } from 'motion/react';

// ── MOCK VAULT DATA ─────────────────────────────────────────────────────────────

interface VaultFolder {
  id: string;
  referenceCode: string;
  description: string;
  originCountry: string;
  destinationPort: string;
  scope: ShipmentScope;
  status: ShipmentStatus;
  vaultPassword: string;
  documentCount: number;
  createdAt: string;
}

const MOCK_VAULT_FOLDERS: VaultFolder[] = [
  {
    id: 'folder-001',
    referenceCode: 'MT-2026-00001',
    description: 'Industrial Steel Coils & Fabricated Parts — Q1 Batch',
    originCountry: 'Japan',
    destinationPort: 'Manila South Harbor',
    scope: 'OVERSEAS',
    status: 'CUSTOMS_CLEARANCE',
    vaultPassword: 'TKY2026',
    documentCount: 4,
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'folder-002',
    referenceCode: 'MT-2026-00002',
    description: 'Automotive Parts & Engine Components — Subic Batch',
    originCountry: 'South Korea',
    destinationPort: 'Subic Bay Freeport',
    scope: 'OVERSEAS',
    status: 'AT_PORT',
    vaultPassword: 'SEL2026',
    documentCount: 2,
    createdAt: '2026-02-03T10:30:00Z',
  },
  {
    id: 'folder-003',
    referenceCode: 'MT-2026-00003',
    description: 'Fresh Produce — Nationwide Cold Chain (Davao-Cebu)',
    originCountry: 'Philippines',
    destinationPort: 'Cebu Baseport',
    scope: 'NATIONWIDE',
    status: 'IN_TRANSIT',
    vaultPassword: 'DAV2026',
    documentCount: 3,
    createdAt: '2026-02-20T14:00:00Z',
  },
];

// ── STATUS BADGE CONFIG ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; className: string }> = {
  PENDING_EXPORTER:  { label: 'Pending Exporter', className: 'bg-gray-100 text-gray-600' },
  COUNTER_OFFER:     { label: 'Counter Offer',    className: 'bg-amber-100 text-amber-700' },
  CONFIRMED:         { label: 'Confirmed',         className: 'bg-maritime-100 text-maritime-700' },
  ESCROW_FUNDED:     { label: 'Escrow Funded',     className: 'bg-maritime-100 text-maritime-400' },
  IN_TRANSIT:        { label: 'In Transit',         className: 'bg-ocean-100 text-ocean-600' },
  AT_PORT:           { label: 'At Port',            className: 'bg-sky-100 text-sky-700' },
  CUSTOMS_CLEARANCE: { label: 'Customs Clearance', className: 'bg-maritime-50 text-maritime-700' },
  OUT_FOR_DELIVERY:  { label: 'Out for Delivery',  className: 'bg-amber-100 text-amber-700' },
  DELIVERED:         { label: 'Delivered',          className: 'bg-green-100 text-green-700' },
  DISPUTED:          { label: 'Disputed',           className: 'bg-coral-50 text-coral-400' },
  CANCELLED:         { label: 'Cancelled',          className: 'bg-gray-100 text-gray-500' },
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── MAIN PAGE ───────────────────────────────────────────────────────────────────

export default function DocumentVaultPage() {
  const { currentUser } = useUserSession();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');

  const filteredFolders = MOCK_VAULT_FOLDERS.filter(
    (f) =>
      f.referenceCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.originCountry.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.destinationPort.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Navigate to the folder's own page — auth/password gate is handled there
  function handleFolderClick(folder: VaultFolder) {
    router.push(`/documents/${folder.id}`);
  }

  return (
    <DashboardLayout>
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FolderLock className="w-6 h-6 text-maritime-400" />
            <h1 className="text-3xl font-black text-maritime-900 tracking-tight">BOC Document Vault</h1>
          </div>
          <p className="text-sm text-gray-500">
            Shipment folders are visible to all authorized users. Click a folder to open it — each folder requires its
            vault password to access documents inside.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1.5 bg-white border border-sand-200 px-3 py-1.5 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-ocean-400" />
            <span className="font-semibold text-gray-700">Vault Access: Authorized</span>
          </div>
          <div className="bg-maritime-50 border border-maritime-100 text-maritime-700 font-bold px-3 py-1.5 rounded-lg">
            {MOCK_VAULT_FOLDERS.length} Folders
          </div>
        </div>
      </div>

      <div className="space-y-4">
          {/* SEARCH */}
          <div className="bg-white border border-sand-200 rounded-xl p-3 flex items-center gap-3">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search folders by reference, description, origin, or port..."
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-gray-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* INSTRUCTION BANNER */}
          <div className="bg-maritime-50 border border-maritime-100 rounded-xl p-3 flex items-start gap-3 text-xs text-maritime-700">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-maritime-400" />
            <div>
              <strong className="font-bold">Folder Vault Security</strong> — Click any folder below to open it in a
              dedicated page. You will be asked to enter the vault password before documents are shown.
              <span className="block mt-0.5 text-maritime-400 font-semibold">
                Demo passwords are shown on each folder card for testing purposes.
              </span>
            </div>
          </div>

          {/* FOLDER LIST */}
          {filteredFolders.length === 0 ? (
            <div className="text-center py-16 bg-white border border-sand-200 rounded-xl text-gray-400 text-xs">
              No shipment folders match your search.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFolders.map((folder) => {
                const statusCfg = STATUS_CONFIG[folder.status];

                return (
                  <motion.button
                    key={folder.id}
                    layout
                    onClick={() => handleFolderClick(folder)}
                    className="w-full text-left bg-white border border-sand-200 hover:border-maritime-300 hover:shadow-md rounded-2xl p-4 md:p-5 flex items-center gap-4 group transition-all cursor-pointer"
                  >
                    {/* Folder icon */}
                    <div className="w-12 h-12 rounded-xl bg-sand-100 group-hover:bg-maritime-50 text-gray-400 group-hover:text-maritime-400 flex items-center justify-center shrink-0 transition-colors">
                      <FolderLock className="w-6 h-6" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-maritime-900 text-sm font-mono tracking-tight">
                          {folder.referenceCode}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusCfg.className}`}>
                          {statusCfg.label}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          folder.scope === 'OVERSEAS'
                            ? 'bg-maritime-50 text-maritime-400'
                            : 'bg-ocean-50 text-ocean-600'
                        }`}>
                          {folder.scope}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-gray-700 truncate">{folder.description}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {folder.originCountry} → {folder.destinationPort}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {folder.documentCount} document{folder.documentCount !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Created {timeAgo(folder.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Right side: demo password + arrow */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:flex items-center gap-1 text-[10px] text-gray-400 font-mono bg-sand-50 border border-sand-200 px-2 py-1 rounded">
                        <Key className="w-3 h-3 text-maritime-400" />
                        <span>
                          Demo: <strong className="text-maritime-400">{folder.vaultPassword}</strong>
                        </span>
                      </div>
                      <div className="text-gray-300 group-hover:text-maritime-400 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* ROLE PERMISSIONS PANEL */}
          <div className="bg-white border border-sand-200 rounded-2xl p-5 space-y-4 mt-2">
            <h3 className="font-extrabold text-xs text-maritime-900 flex items-center gap-1.5 border-b border-sand-100 pb-3">
              <ShieldCheck className="w-4 h-4 text-ocean-400" />
              Vault Access Matrix
            </h3>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              All roles can view, unlock, and download documents. Access to each folder is secured by its vault password.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px]">
              {[
                { role: 'Importer / Exporter' },
                { role: 'Customs Broker' },
                { role: 'Freight Forwarder' },
                { role: 'Shipping Line Captain' },
                { role: 'Warehouse Operator' },
                { role: 'Port Authority Officer' },
                { role: 'Trucker' },
              ].map((r) => (
                <div key={r.role} className="border border-sand-100 rounded-lg p-2.5 space-y-1">
                  <span className="font-bold text-maritime-900 block">{r.role}</span>
                  <div className="grid grid-cols-3 gap-1 text-[9px] font-mono">
                    <span className="text-ocean-600">✓ View</span>
                    <span className="text-ocean-600">✓ Unlock</span>
                    <span className="text-ocean-600">✓ Download</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
    </DashboardLayout>
  );
}
