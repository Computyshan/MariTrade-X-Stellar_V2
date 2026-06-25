'use client';
/**
 * hooks/use-freighter.ts
 *
 * React hook that tracks Freighter wallet connection state across a session.
 * Persists the connected public key in component state only — no localStorage.
 */

import { useState, useEffect, useCallback } from 'react';
import { connectFreighter, isFreighterInstalled } from '@/lib/stellar/freighter';

export interface FreighterState {
  /** Stellar G… public key of the connected wallet, or null if not connected. */
  publicKey: string | null;
  /** True while a connection or signature request is in flight. */
  connecting: boolean;
  /** True if the Freighter extension is detected in the browser. */
  installed: boolean;
  /** Last error message, cleared on the next successful connect. */
  error: string | null;
  /** Trigger a connect-wallet popup. Returns the public key on success. */
  connect: () => Promise<string>;
  /** Clear error state. */
  clearError: () => void;
}

export function useFreighter(): FreighterState {
  const [publicKey,  setPublicKey]  = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [installed,  setInstalled]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Check if the extension is present (runs once on mount)
  useEffect(() => {
    isFreighterInstalled().then(setInstalled);
  }, []);

  const connect = useCallback(async (): Promise<string> => {
    setConnecting(true);
    setError(null);
    try {
      const key = await connectFreighter();
      setPublicKey(key);
      return key;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Freighter connection failed.';
      setError(msg);
      throw err; // re-throw so callers can handle it
    } finally {
      setConnecting(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { publicKey, connecting, installed, error, connect, clearError };
}
