'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUserSession } from '@/hooks/use-user-session';

// Pages that don't require authentication
const PUBLIC_PATHS = ['/login', '/register'];

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, loading, init } = useUserSession();
  const pathname = usePathname();
  const router = useRouter();

  // Start auth listener once on mount
  useEffect(() => {
    const unsub = init();
    return unsub;
  }, []);

  // Redirect logic after loading is resolved
  useEffect(() => {
    if (loading) return;

    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

    if (!currentUser && !isPublic) {
      router.replace('/login');
    } else if (currentUser && isPublic) {
      // Already logged in — send to dashboard
      router.replace('/dashboard');
    }
  }, [currentUser, loading, pathname]);

  // Show nothing while resolving session to avoid flash
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-50">
        <div className="w-8 h-8 border-4 border-maritime-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
