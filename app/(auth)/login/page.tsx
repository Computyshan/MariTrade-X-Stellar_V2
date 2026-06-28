'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserSession } from '@/hooks/use-user-session';

export default function LoginPage() {
  const router = useRouter();
  const { setCurrentUser } = useUserSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Sign in via Supabase Auth directly on the client.
      // We capture the session here so we can forward the access_token to the
      // API route — the browser Supabase client stores the session in localStorage,
      // NOT as an HTTP cookie, so requireAuth() cannot read it from the cookie
      // header alone. Passing it as Authorization: Bearer is the reliable bridge.
      const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (authError || !signInData.session) {
        setError('Invalid email or password. Please try again.');
        return;
      }

      const accessToken = signInData.session.access_token;

      // Load the app-level user row. The server verifies the session via the
      // Bearer token since the cookie isn't available server-side (localStorage storage).
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      const result = await res.json();

      if (result.success) {
        setCurrentUser(result.data);
        // Redirect: pending KYC users go to onboarding, returning users to dashboard
        if (result.data.kycStatus === 'PENDING') {
          router.push('/onboarding');
        } else {
          router.push('/dashboard');
        }
      } else {
        setError(result.error || 'Login failed.');
      }
    } catch {
      setError('Server connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mist-light flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-mist rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">

        {/* Brand */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Image
              src="/MariTrade logo.png"
              alt="MariTrade"
              width={160}
              height={64}
              className="h-14 w-auto object-contain"
              priority
            />
          <div>
            <h1 className="text-2xl font-display font-medium text-ink tracking-tight">MariTrade</h1>
            <p className="text-xs text-ink-faint font-medium">Shipment Logistics Tracker & MSME Platform</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-wine-light border border-wine/20 text-wine text-xs p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-ink-faint uppercase tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="juan@delacruz.ph"
              className="w-full bg-mist-light border border-mist rounded-lg px-3 py-2 text-sm outline-none focus:border-amber focus:bg-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-ink-faint uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full bg-mist-light border border-mist rounded-lg px-3 py-2 text-sm outline-none focus:border-amber focus:bg-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber hover:bg-amber-hover disabled:opacity-60 text-white font-bold py-2.5 rounded-lg text-sm transition-all shadow-sm cursor-pointer"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="border-t border-mist pt-4 text-center text-xs text-ink-faint">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-amber hover:text-amber-hover font-bold">
            Register here →
          </Link>
        </div>
      </div>
    </div>
  );
}
