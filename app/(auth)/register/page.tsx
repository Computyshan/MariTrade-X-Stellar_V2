'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ship, AlertCircle } from 'lucide-react';
import { useUserSession } from '@/hooks/use-user-session';

export default function RegisterPage() {
  const router = useRouter();
  const { setCurrentUser } = useUserSession();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('+63 ');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName || !email || !password) {
      setError('Full name, email, and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, fullAddress: address, contactNumber: phone }),
      });

      const result = await res.json();
      if (result.success && result.data) {
        setCurrentUser(result.data);
        router.push('/onboarding');
      } else {
        setError(result.error || 'Registration failed.');
      }
    } catch {
      setError('Server connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-sand-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">

        {/* Brand */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 bg-maritime-400 rounded-xl flex items-center justify-center">
            <Ship className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-maritime-900 tracking-tight">MariTrade V2</h1>
            <p className="text-xs text-gray-500 font-medium">Create your account</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-coral-50 border border-coral-200 text-coral-700 text-xs p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
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
              autoComplete="email"
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
              autoComplete="new-password"
              placeholder="Min. 6 characters"
              className="w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-maritime-400 focus:bg-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Confirm Password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Re-enter password"
              className="w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-maritime-400 focus:bg-white"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Contact Number <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="+63 917 123 4567"
              className="w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-maritime-400 focus:bg-white font-mono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Address <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
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
            className="w-full bg-maritime-400 hover:bg-maritime-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-lg text-sm transition-all shadow-sm cursor-pointer"
          >
            {loading ? 'Creating account…' : 'Continue to Onboarding'}
          </button>
        </form>

        <div className="border-t border-sand-200 pt-4 text-center text-xs text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-maritime-400 hover:text-maritime-900 font-bold">
            Sign in →
          </Link>
        </div>
      </div>
    </div>
  );
}
