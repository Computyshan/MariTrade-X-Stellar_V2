'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import { 
  FileText, 
  Search, 
  Lock, 
  Unlock, 
  Download, 
  Info,
  ShieldCheck,
  Plus
} from 'lucide-react';
import { ShipmentDocument } from '@/types';

export default function DocumentCenter() {
  const { currentUser } = useUserSession();

  const [documents, setDocuments] = useState<ShipmentDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Policy matrices based on '/lib/permissions/documents.ts'
  const rules = [
    { role: 'Customs Broker', read: '✓ YES', write: '✓ YES (Submit Entry Declaration)' },
    { role: 'Importer', read: '✓ YES', write: '✕ NO' },
    { role: 'Exporter', read: '✓ YES', write: '✕ NO' },
    { role: 'Trucker / Logistics Line', read: '✕ NO (Access Denied)', write: '✕ NO' },
    { role: 'Port Authority Officer', read: '✓ YES (Verification only)', write: '✕ NO' }
  ];

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        setLoading(true);
        // Direct mock load
        const fallbackDocs: ShipmentDocument[] = [
          {
            id: 'doc-1',
            shipmentId: 'shipment-tokyo-manila-1',
            fileName: 'BOC_Customs_Entry_Declaration_Signed.pdf',
            fileUrl: 'https://picsum.photos/seed/doc1/800/600',
            version: 2,
            isLatest: true,
            uploadedById: 'carlos-broker-id',
            createdAt: new Date(Date.now() - 36 * 3600000).toISOString()
          },
          {
            id: 'doc-2',
            shipmentId: 'shipment-tokyo-manila-1',
            fileName: 'Cargo_Manifest_Packing_List_Osaka.xlsx',
            fileUrl: 'https://picsum.photos/seed/doc2/800/600',
            version: 1,
            isLatest: true,
            uploadedById: 'exporter-osaka-id',
            createdAt: new Date(Date.now() - 72 * 3600000).toISOString()
          },
          {
            id: 'doc-3',
            shipmentId: 'shipment-tokyo-manila-2',
            fileName: 'Subic_Dry_Harbour_Gated_Release_Permit.pdf',
            fileUrl: 'https://picsum.photos/seed/doc3/800/600',
            version: 1,
            isLatest: true,
            uploadedById: 'port-subic-id',
            createdAt: new Date(Date.now() - 12 * 3600000).toISOString()
          }
        ];
        setDocuments(fallbackDocs);
      } catch {
        console.warn('Doc fetch failed');
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, []);

  // Filter doc search
  const filtered = documents.filter(d => 
    d.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Does the current active user role have READ permission?
  // Truckers are locked out from confidential financial declarations!
  const canRead = currentUser.jobRole !== 'TRUCKER';

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-maritime-900 tracking-tight">Bureau of Customs Document Center</h1>
          <p className="text-sm text-gray-500 mt-1">Direct broker lodging, entry declarations, and secure row-level permission filters.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Core Documents Catalog (3/4 width) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-sand-200 flex items-center justify-between">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search file names (declarations, manifests)..."
                className="w-full bg-sand-50 border border-sand-200 rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-maritime-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {!canRead ? (
            <div className="bg-red-50 border border-red-200 p-8 rounded-2xl text-center space-y-4">
              <Lock className="w-12 h-12 text-red-500 mx-auto" />
              <h3 className="font-extrabold text-base text-red-950">BOC Security Restriciton</h3>
              <p className="text-xs text-red-700 max-w-sm mx-auto">
                Your currently active profile (<strong className="uppercase">{currentUser.jobRole}</strong>) is restricted from opening confidential customs entries under Article II cargo encryption.
              </p>
              <div className="text-[11px] text-gray-501 font-medium bg-white p-3 rounded border border-sand-200 max-w-sm mx-auto">
                💡 Swiftly swap to &quot;Carlos (CUSTOMS_BROKER)&quot; via the Testing toolbar above to lock or authorize document submissions.
              </div>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-maritime-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 bg-white border border-sand-200 rounded-xl text-gray-400 text-xs">
              No matching clearance files registered.
            </div>
          ) : (
            <div className="bg-white border border-sand-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-sand-200">
              {filtered.map((doc) => (
                <div key={doc.id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-coral-50 text-coral-400 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 text-xs">
                      <strong className="font-bold text-maritime-900 leading-tight block">{doc.fileName}</strong>
                      <span className="text-[10px] text-gray-400 block font-mono">UPLOADED: {new Date(doc.createdAt).toLocaleString()}</span>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="bg-sand-100 text-gray-500 border border-sand-200 px-1.5 rounded font-mono text-[9px]">v{doc.version}</span>
                        {doc.version > 1 && (
                          <span className="bg-amber-100 text-amber-700 px-1.5 rounded font-black uppercase text-[8px]">Amended</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={doc.fileUrl}
                      download
                      className="bg-sand-50 hover:bg-sand-100 border border-sand-200 text-gray-700 px-3 py-1.5 rounded text-xs inline-flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <Download className="w-3.5 h-3.5 text-gray-400" />
                      <span>Download File</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Rule Matrix (1/4 width) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-sand-200 p-5 rounded-2xl shadow-sm space-y-4">
            <h3 className="font-extrabold text-xs text-maritime-900 border-b border-sand-100 pb-2 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-ocean-400" />
              <span>Role Permissions Matrix</span>
            </h3>

            <div className="space-y-3 text-[11px] text-gray-600 leading-normal">
              {rules.map((r, idx) => (
                <div key={idx} className="border-b border-sand-100 pb-2 last:border-0 last:pb-0 font-medium">
                  <span className="block font-bold text-maritime-900">{r.role}</span>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-500 pt-0.5 font-mono">
                    <span>Read: {r.read}</span>
                    <span>Write: {r.write}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
