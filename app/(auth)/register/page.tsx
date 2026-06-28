'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserSession } from '@/hooks/use-user-session';

export default function RegisterPage() {
  const router = useRouter();
  const { setCurrentUser } = useUserSession();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
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
        body: JSON.stringify({
          email,
          password,
          fullName,
          fullAddress: address || null,
          contactNumber: phone.trim() || null,
        }),
      });

      const result = await res.json();
      if (!result.success) {
        setError(result.error || 'Registration failed.');
        return;
      }

      // Registration succeeded — sign in immediately to establish a session.
      // Capture the access_token so it can be forwarded as Authorization: Bearer
      // to any subsequent API calls (the browser Supabase client stores the
      // session in localStorage, which is not visible to server-side requireAuth()).
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (signInError || !signInData.session) {
        // Account created but auto-login failed (e.g. email confirmation required)
        setError('Account created! Please check your email to confirm your address, then sign in.');
        return;
      }

      setCurrentUser(result.data);
      // Store the token in sessionStorage so the onboarding page can pass it
      // as Authorization: Bearer when it calls /api/auth/onboarding.
      sessionStorage.setItem('mt_access_token', signInData.session.access_token);

      router.push('/onboarding');
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
            <p className="text-xs text-ink-faint font-medium">Create your account</p>
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
            <label className="block text-xs font-bold text-ink-faint uppercase tracking-wider">Full Name</label>
            <input
              type="text"
              required
              placeholder="Juan Dela Cruz"
              className="w-full bg-mist-light border border-mist rounded-lg px-3 py-2 text-sm outline-none focus:border-amber focus:bg-white"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-ink-faint uppercase tracking-wider">Email Address</label>
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
            <label className="block text-xs font-bold text-ink-faint uppercase tracking-wider">Password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Min. 6 characters"
              className="w-full bg-mist-light border border-mist rounded-lg px-3 py-2 text-sm outline-none focus:border-amber focus:bg-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-ink-faint uppercase tracking-wider">Confirm Password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Re-enter password"
              className="w-full bg-mist-light border border-mist rounded-lg px-3 py-2 text-sm outline-none focus:border-amber focus:bg-white"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Contact Number <span className="text-ink-faint/70 font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="+63 917 123 4567"
              className="w-full bg-mist-light border border-mist rounded-lg px-3 py-2 text-sm outline-none focus:border-amber focus:bg-white font-sans tracking-wide"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Address <span className="text-ink-faint/70 font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Binondo, Manila"
              className="w-full bg-mist-light border border-mist rounded-lg px-3 py-2 text-sm outline-none focus:border-amber focus:bg-white"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber hover:bg-amber-hover disabled:opacity-60 text-white font-bold py-2.5 rounded-lg text-sm transition-all shadow-sm cursor-pointer"
          >
            {loading ? 'Creating account…' : 'Continue to Onboarding'}
          </button>
        </form>

        <div className="border-t border-mist pt-4 text-center text-xs text-ink-faint">
          Already have an account?{' '}
          <Link href="/login" className="text-amber hover:text-amber-hover font-bold">
            Sign in →
          </Link>
        </div>
      </div>
    </div>
  );
}
