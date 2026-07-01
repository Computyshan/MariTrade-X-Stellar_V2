'use client';

/**
 * ExternalCredentialsSection
 * ───────────────────────────
 * Lets any user (Trade Party or Logistics Chain) import prior-experience
 * credentials onto their public profile — mixed media:
 *   - CERTIFICATE_URL   → a link to an e-certificate hosted elsewhere
 *   - CERTIFICATE_IMAGE → a photographed/scanned certificate, uploaded
 *   - RESUME_PDF        → an existing resume/CV, uploaded as a PDF
 *
 * Once at least one credential is on file, the user is shown with a
 * "Pre-Verified" badge everywhere they appear on MariNet (see
 * UserProfileModal and the Network directory).
 *
 * Saves are immediate per add/remove — no separate "Save" step, so the
 * badge unlocks the moment the first credential is added.
 */

import React, { useState, useRef } from 'react';
import {
  Award,
  Link2,
  Image as ImageIcon,
  FileText,
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  UploadCloud,
  Sparkles,
} from 'lucide-react';
import { authFetch } from '@/hooks/use-user-session';
import { User, ExternalCredential, ExternalCredentialType } from '@/types';

interface Props {
  currentUser: User;
  setCurrentUser: (user: User) => void;
}

const TYPE_META: Record<ExternalCredentialType, { label: string; short: string; icon: React.ReactNode; accept?: string }> = {
  CERTIFICATE_URL:   { label: 'E-Certificate (Link)', short: 'Link',    icon: <Link2 className="w-3.5 h-3.5" /> },
  CERTIFICATE_IMAGE: { label: 'Certificate (Image)',  short: 'Image',   icon: <ImageIcon className="w-3.5 h-3.5" />, accept: 'image/jpeg,image/png,image/webp' },
  RESUME_PDF:        { label: 'Resume / CV (PDF)',    short: 'Résumé',  icon: <FileText className="w-3.5 h-3.5" />, accept: 'application/pdf' },
};

export default function ExternalCredentialsSection({ currentUser, setCurrentUser }: Props) {
  const credentials = currentUser.externalCredentials ?? [];
  const isPreVerified = credentials.length > 0;

  const [type, setType] = useState<ExternalCredentialType>('CERTIFICATE_URL');
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [url, setUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle('');
    setIssuer('');
    setUrl('');
    setUploadedFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const persist = async (nextCredentials: ExternalCredential[]) => {
    setSaving(true);
    setError('');
    try {
      const res = await authFetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, externalCredentials: nextCredentials }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setCurrentUser(json.data);
        return true;
      }
      setError(json.error || 'Failed to save credential.');
      return false;
    } catch {
      setError('Network error — please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authFetch('/api/upload?bucket=credentials', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.success) {
        setUrl(json.url);
        setUploadedFileName(file.name);
      } else {
        setError(json.error ?? 'Upload failed.');
      }
    } catch {
      setError('Network error — upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleAdd = async () => {
    setError('');
    setSuccess('');
    if (!title.trim()) { setError('Give this credential a title.'); return; }
    if (!url.trim()) {
      setError(type === 'CERTIFICATE_URL' ? 'Paste a link to your e-certificate.' : 'Upload a file first.');
      return;
    }
    if (type === 'CERTIFICATE_URL') {
      try { new URL(url.trim()); } catch { setError("That doesn't look like a valid URL."); return; }
    }
    if (credentials.length >= 12) { setError('You can list at most 12 credentials.'); return; }

    const entry: ExternalCredential = {
      id: `cred_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      title: title.trim(),
      issuer: issuer.trim() || undefined,
      url: url.trim(),
      addedAt: new Date().toISOString(),
    };

    const wasEmpty = credentials.length === 0;
    const ok = await persist([...credentials, entry]);
    if (ok) {
      resetForm();
      setSuccess(wasEmpty ? '🎉 Pre-Verified badge unlocked! It now shows next to your name on MariNet.' : 'Credential added.');
      setTimeout(() => setSuccess(''), 4000);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError('');
    setSuccess('');
    const next = credentials.filter(c => c.id !== id);
    const ok = await persist(next);
    if (ok && next.length === 0) {
      setSuccess('Credential removed. Your Pre-Verified badge is now hidden until you add another.');
      setTimeout(() => setSuccess(''), 5000);
    }
    setDeletingId(null);
  };

  const meta = TYPE_META[type];

  return (
    <div className="bg-white border border-mist rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-ink flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <Award className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm leading-tight">External Credentials</h2>
            <p className="text-white/40 text-[10px] mt-0.5">Import prior experience — visible on your public profile</p>
          </div>
        </div>
        {isPreVerified ? (
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(254,153,0,0.2)', color: 'var(--color-amber)' }}>
            <Sparkles className="w-3 h-3" /> Pre-Verified Active
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/10 text-white/50">
            Not yet unlocked
          </span>
        )}
      </div>

      <div className="p-6 space-y-5">
        <p className="text-xs text-ink-faint leading-relaxed">
          Add certificates, e-certificates, or an existing resume to show other MariNet members the
          experience you bring <em>into</em> MariTrade. Once you add your first credential, a{' '}
          <strong className="text-ink">Pre-Verified</strong> badge appears next to your name across the
          platform — separate from, and in addition to, your account&apos;s KYC status.
        </p>

        {/* Feedback */}
        {error && (
          <div className="bg-wine-light border border-wine/20 text-wine px-4 py-3 rounded-xl flex items-center gap-2.5 text-xs font-bold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-amber-light border border-amber/25 px-4 py-3 rounded-xl flex items-center gap-2.5 text-xs font-bold" style={{ color: 'var(--color-amber)' }}>
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Existing credentials */}
        {credentials.length > 0 && (
          <div className="space-y-2">
            {credentials.map(c => {
              const m = TYPE_META[c.type];
              return (
                <div key={c.id} className="flex items-center gap-3 border border-mist rounded-xl px-3.5 py-3 bg-mist-light/40">
                  <div className="w-8 h-8 rounded-lg bg-white border border-mist flex items-center justify-center text-ink-faint flex-shrink-0">
                    {m.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-ink truncate">{c.title}</p>
                    <p className="text-[10px] text-ink-faint truncate">
                      {m.short}{c.issuer ? ` · ${c.issuer}` : ''} · Added {new Date(c.addedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[10px] font-bold text-ink-faint hover:text-ink border border-mist hover:bg-white px-2 py-1.5 rounded-lg transition-all flex-shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" /> View
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    disabled={deletingId === c.id || saving}
                    className="flex items-center justify-center w-7 h-7 rounded-lg border border-mist text-ink-faint hover:text-wine hover:bg-wine-light hover:border-wine/20 transition-all flex-shrink-0 disabled:opacity-50"
                    title="Remove credential"
                  >
                    {deletingId === c.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add new credential */}
        <div className="border border-dashed border-mist-dark rounded-xl p-4 space-y-3.5">
          <p className="text-[10px] font-extrabold text-ink-faint uppercase tracking-wider font-mono">Add a Credential</p>

          {/* Type toggle */}
          <div className="flex gap-1.5 flex-wrap">
            {(Object.keys(TYPE_META) as ExternalCredentialType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setType(t); setUrl(''); setUploadedFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer
                  ${type === t ? 'text-white border-transparent' : 'border-mist text-ink-faint hover:bg-mist-light'}`}
                style={type === t ? { background: 'var(--theme-accent)' } : {}}
              >
                {TYPE_META[t].icon}
                {TYPE_META[t].label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-ink-faint uppercase tracking-wider block">Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Certified International Trade Professional"
                className="w-full bg-white border border-mist rounded-lg px-3 py-2 text-xs outline-none focus:border-ink-faint transition-all"
                maxLength={120}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-ink-faint uppercase tracking-wider block">Issuer (optional)</label>
              <input
                type="text"
                value={issuer}
                onChange={e => setIssuer(e.target.value)}
                placeholder="e.g. Philippine Chamber of Commerce"
                className="w-full bg-white border border-mist rounded-lg px-3 py-2 text-xs outline-none focus:border-ink-faint transition-all"
                maxLength={120}
              />
            </div>
          </div>

          {/* URL vs file upload */}
          {type === 'CERTIFICATE_URL' ? (
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-ink-faint uppercase tracking-wider block">Certificate Link</label>
              <div className="relative">
                <Link2 className="w-3.5 h-3.5 text-ink-faint absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-white border border-mist rounded-lg pl-8 pr-3 py-2 text-xs font-mono outline-none focus:border-ink-faint transition-all"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-ink-faint uppercase tracking-wider block">
                {type === 'RESUME_PDF' ? 'Upload Resume (PDF)' : 'Upload Certificate Image'}
              </label>
              {url ? (
                <div className="flex items-center gap-2 bg-teal-light border border-teal/20 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 text-teal flex-shrink-0" />
                  <span className="text-[11px] font-bold text-teal truncate flex-1">{uploadedFileName || 'File uploaded'}</span>
                  <button type="button" onClick={() => { setUrl(''); setUploadedFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-teal/70 hover:text-wine text-[10px] font-bold">
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-mist-dark hover:border-ink-faint rounded-lg py-3 cursor-pointer transition-all bg-white">
                  <input ref={fileInputRef} type="file" accept={meta.accept} className="sr-only" onChange={handleFileSelect} />
                  {uploading
                    ? <RefreshCw className="w-4 h-4 text-ink-faint animate-spin" />
                    : <UploadCloud className="w-4 h-4 text-ink-faint" />}
                  <span className="text-[11px] font-bold text-ink-faint">
                    {uploading ? 'Uploading…' : type === 'RESUME_PDF' ? 'Select a PDF' : 'Select an image'}
                  </span>
                </label>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || uploading}
            className="w-full flex items-center justify-center gap-2 text-white font-bold py-2.5 rounded-lg text-xs transition-all cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--theme-accent)' }}
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : 'Add Credential'}
          </button>
        </div>

        <p className="text-[10px] text-ink-faint/70 italic">
          Credentials are shown to everyone on MariNet exactly as entered — MariTrade does not verify
          their authenticity. Only add credentials you can stand behind.
        </p>
      </div>
    </div>
  );
}
