'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUserSession } from '@/hooks/use-user-session';

// Pages that don't require authentication
// /onboarding is intentionally excluded — it requires a valid session
// (the user just registered) but must not redirect logged-in users away.
const PUBLIC_PATHS = ['/login', '/register', '/track', '/'];
const AUTH_ONLY_PATHS = ['/onboarding']; // logged-in only, but not redirected to dashboard

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, loading, init, refreshAllUsers } = useUserSession();
  const pathname = usePathname();
  const router = useRouter();

  // Start auth listener once on mount
  useEffect(() => {
    const unsub = init();
    return unsub;
  }, []);

  // Populate allUsers once the session is resolved
  useEffect(() => {
    if (currentUser) refreshAllUsers();
  }, [currentUser?.id]);

  // Redirect logic after loading is resolved
  useEffect(() => {
    if (loading) return;

    const isPublic = PUBLIC_PATHS.some((p) =>
      p === '/' ? pathname === '/' : pathname.startsWith(p)
    );
    const isAuthOnly = AUTH_ONLY_PATHS.some((p) => pathname.startsWith(p));

    if (!currentUser && !isPublic && !isAuthOnly) {
      // Unauthenticated user trying to reach a protected page
      router.replace('/login');
    } else if (!currentUser && isAuthOnly) {
      // Unauthenticated user trying to reach /onboarding — send to register
      router.replace('/register');
    } else if (currentUser && (pathname === '/login' || pathname === '/register')) {
      // Already logged in — skip auth pages
      if (currentUser.kycStatus === 'PENDING') {
        router.replace('/onboarding');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [currentUser, loading, pathname]);

  // Show nothing while resolving session to avoid flash
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mist-light">
        <div className="w-8 h-8 border-4 border-amber border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
