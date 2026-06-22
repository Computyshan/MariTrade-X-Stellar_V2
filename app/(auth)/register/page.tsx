'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ship, Shield, Check, Info } from 'lucide-react';
import { useUserSession } from '@/hooks/use-user-session';

export default function RegisterPage() {
  const router = useRouter();
  const { allUsers, setCurrentUser } = useUserSession();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('+63 ');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setErrorText('Please enter your full name, email, and password.');
      return;
    }

    try {
      setLoading(true);
      setErrorText('');
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName,
          fullAddress: address,
          contactNumber: phone
        })
      });

      const result = await res.json();
      if (result.success && result.data) {
        // Log user in
        setCurrentUser(result.data);
        router.push('/onboarding');
      } else {
        setErrorText(result.error || 'Registration failed.');
      }
    } catch {
      setErrorText('Server connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand-50 font-sans flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-sand-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Brand logo */}
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <div className="w-12 h-12 bg-maritime-400 rounded-xl flex items-center justify-center text-white">
            <Ship className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-maritime-900 tracking-tight">MariTrade V2</h1>
            <p className="text-xs text-gray-500 font-medium">Stellar Blockchain Escrow & Document Control</p>
          </div>
        </div>

        {/* Info panel */}
        <div className="bg-maritime-50 p-3 rounded-lg border border-maritime-100 flex items-start gap-2 text-xs text-maritime-900">
          <Info className="w-4 h-4 text-maritime-400 flex-shrink-0 mt-0.5" />
          <p>This is a sandboxed prototype. Registration immediately seeds your account in the local Stellar ledger.</p>
        </div>

        {errorText && (
          <p className="bg-coral-50 border border-coral-400/20 text-coral-600 text-xs py-2 px-3 rounded-lg text-center font-bold">
            {errorText}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Full Name</label>
            <input
              type="text"
              required
              placeholder="Juan Dela Cruz"
              className="w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-maritime-400 focus:bg-white"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Email Address</label>
            <input
              type="email"
              required
              placeholder="juan@delacruz.ph"
              className="w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-maritime-400 focus:bg-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              className="w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-maritime-400 focus:bg-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Contact Number (PH format)</label>
            <input
              type="text"
              placeholder="+63 917 123 4567"
              className="w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-maritime-400 focus:bg-white font-mono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Full Physical address</label>
            <input
              type="text"
              placeholder="Binondo, Manila"
              className="w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-maritime-400 focus:bg-white"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-maritime-400 hover:bg-maritime-700 text-white font-bold py-2.5 rounded-lg text-sm transition-all shadow-sm cursor-pointer"
          >
            {loading ? 'Creating Wallet & Seeds...' : 'Continue to Onboarding'}
          </button>
        </form>

        <div className="border-t border-sand-200 pt-4 text-center">
          <Link href="/dashboard" className="text-xs text-maritime-400 hover:text-maritime-900 font-bold underline">
            Or skip register & use Pre-seeded Demo Portal →
          </Link>
        </div>
      </div>
    </div>
  );
}
