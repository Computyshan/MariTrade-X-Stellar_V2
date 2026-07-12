'use client';

/**
 * components/VesselPositionCard.tsx
 *
 * Phase 3 — Live Vessel Position display.
 *
 * Shows the last-known AIS position for a shipment's assigned vessel,
 * sourced from the ais_vessel_positions cache (see lib/db.ts /
 * scripts/ais-worker.ts). Renders on the shipment detail page whenever
 * shipment.vesselMmsi is set — i.e. once a Freight Forwarder has captured
 * the vessel identity at SPACE_ON_VESSEL_SECURED.
 *
 * "Live" here means: this card polls GET /api/vessels/[mmsi] every 30s and
 * repaints with whatever the cache currently holds. It does NOT mean a
 * persistent live feed straight from the vessel — the underlying position
 * is only as fresh as scripts/ais-worker.ts's last observed report for
 * that MMSI. A visible "stale" flag covers the case where the worker isn't
 * running or the vessel hasn't reported recently, rather than silently
 * showing an old pin as if it were current.
 *
 * Map rendering uses an OpenStreetMap embed iframe (openstreetmap.org/export)
 * rather than a paid maps API — no API key required, good enough for a
 * single-pin last-known-position view.
 */

import { useEffect, useState, useCallback } from 'react';
import { Ship, RefreshCw, AlertTriangle, Radio, Anchor } from 'lucide-react';
import { authFetch } from '@/hooks/use-user-session';
import { AisVesselPosition } from '@/types';
import { guessFlagState } from '@/lib/vessel-tracking';

const POLL_INTERVAL_MS = 30_000;
// Deliberately tighter than ais-tracking.ts's 6h MAX_POSITION_AGE_MS (which
// governs whether a position can corroborate a departure milestone at all).
// This is just the UI's "still fresh enough to call live" threshold.
const STALE_AFTER_MS = 30 * 60 * 1000; // 30 minutes
const UNDERWAY_SOG_KNOTS = 1.0;

type FetchState =
  | { status: 'loading' }
  | { status: 'not_tracked' }
  | { status: 'error'; message: string }
  | { status: 'ok'; position: AisVesselPosition };

function timeAgo(iso: string, now: number): string {
  const ms = now - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function VesselPositionCard({
  mmsi,
  vesselName,
}: {
  mmsi: string;
  vesselName?: string;
}) {
  const [state, setState] = useState<FetchState>({ status: 'loading' });
  // Render must stay pure, so "current time" for staleness/age display is
  // read from state (ticked on an interval) rather than calling Date.now()
  // directly while rendering.
  const [now, setNow] = useState(() => Date.now());

  const fetchPosition = useCallback(async (silent = false) => {
    if (!silent) setState({ status: 'loading' });
    try {
      const res = await authFetch(`/api/vessels/${encodeURIComponent(mmsi)}`);
      if (res.status === 404) {
        setState({ status: 'not_tracked' });
        return;
      }
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        setState({ status: 'not_tracked' });
        return;
      }
      setState({ status: 'ok', position: json.data as AisVesselPosition });
    } catch {
      // Background polls fail silently and keep last-good data, same
      // pattern as the shipment page's own fetchDetails({ silent: true }).
      setState(s => (s.status === 'ok' ? s : { status: 'error', message: 'Could not reach the position cache.' }));
    }
  }, [mmsi]);

  useEffect(() => {
    // Kick off the initial fetch on a timer tick rather than calling it
    // synchronously in the effect body — fetchPosition sets state before its
    // first `await`, and calling it directly here would run that setState
    // synchronously as part of the effect (react-hooks/set-state-in-effect).
    // The component already renders its 'loading' state from the initial
    // useState value, so this doesn't delay what the user sees.
    const initialFetchTimer = setTimeout(() => fetchPosition(), 0);
    const pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') fetchPosition(true);
    }, POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchPosition(true);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearTimeout(initialFetchTimer);
      clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchPosition]);

  // Separate tick just for the "age" / "stale" display, so it stays fresh
  // even between position polls without touching fetch logic.
  useEffect(() => {
    const tickTimer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(tickTimer);
  }, []);

  const flag = guessFlagState(mmsi);
  const displayName =
    vesselName || (state.status === 'ok' ? state.position.shipName : undefined) || 'Unnamed vessel';

  return (
    <div className="bg-white border border-mist p-6 rounded-2xl shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-sm text-ink tracking-tight flex items-center gap-2">
          <Radio className="w-5 h-5 text-steel" /><span>Live Vessel Position</span>
        </h3>
        {state.status === 'ok' && (
          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-teal">
            <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" /> AIS Live
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint font-sans">
        <Ship className="w-3.5 h-3.5 text-amber flex-shrink-0" />
        <span className="font-bold text-ink">{displayName}</span>
        <span>· MMSI {mmsi}</span>
        {flag && <span>· Flag: {flag}</span>}
      </div>

      {state.status === 'loading' && (
        <div className="flex items-center gap-1.5 text-[11px] text-ink-faint py-6 justify-center">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Checking last-known AIS position…
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex items-start gap-1.5 text-[11px] text-wine bg-wine-light border border-wine/20 rounded-lg px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {state.message}
        </div>
      )}

      {state.status === 'not_tracked' && (
        <div className="flex items-start gap-1.5 text-[11px] text-ink-faint bg-mist-light border border-mist rounded-lg px-3 py-2.5">
          <Anchor className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            No AIS position observed for this vessel yet. This appears automatically once the tracking worker
            sees a report for MMSI {mmsi} — usually within a few minutes of the vessel being underway. If this
            never updates, check that <code className="font-mono">npm run ais-worker</code> is running.
          </span>
        </div>
      )}

      {state.status === 'ok' && (() => {
        const p = state.position;
        const hasCoords = p.latitude != null && p.longitude != null;
        const ageMs = now - new Date(p.receivedAt).getTime();
        const isStale = ageMs > STALE_AFTER_MS;
        const isUnderway =
          (p.sogKnots ?? 0) >= UNDERWAY_SOG_KNOTS ||
          (p.navStatus?.toLowerCase().includes('under way') ?? false);

        return (
          <div className="space-y-3">
            {hasCoords && (
              <div className="rounded-xl overflow-hidden border border-mist relative">
                <iframe
                  key={`${p.latitude!.toFixed(3)},${p.longitude!.toFixed(3)}`}
                  title="Vessel last-known position map"
                  className="w-full h-48 block"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${p.longitude! - 0.4}%2C${p.latitude! - 0.25}%2C${p.longitude! + 0.4}%2C${p.latitude! + 0.25}&layer=mapnik&marker=${p.latitude}%2C${p.longitude}`}
                />
                {isStale && (
                  <div className="absolute top-2 left-2 bg-amber text-white text-[9px] font-black uppercase tracking-wide px-2 py-1 rounded-full shadow">
                    Stale position
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-mist-light border border-mist rounded-lg p-2.5">
                <span className="text-[9px] text-ink-faint font-bold uppercase tracking-wide block">Coordinates</span>
                <strong className="text-ink font-sans">
                  {hasCoords ? `${p.latitude!.toFixed(4)}°, ${p.longitude!.toFixed(4)}°` : 'Unavailable'}
                </strong>
              </div>
              <div className="bg-mist-light border border-mist rounded-lg p-2.5">
                <span className="text-[9px] text-ink-faint font-bold uppercase tracking-wide block">Speed</span>
                <strong className="text-ink font-sans">{p.sogKnots != null ? `${p.sogKnots.toFixed(1)} kn` : '—'}</strong>
              </div>
              <div className="bg-mist-light border border-mist rounded-lg p-2.5">
                <span className="text-[9px] text-ink-faint font-bold uppercase tracking-wide block">Status</span>
                <strong className={`font-sans ${isUnderway ? 'text-teal' : 'text-ink'}`}>
                  {p.navStatus || (isUnderway ? 'Underway' : 'Unknown')}
                </strong>
              </div>
              <div className="bg-mist-light border border-mist rounded-lg p-2.5">
                <span className="text-[9px] text-ink-faint font-bold uppercase tracking-wide block">Last report</span>
                <strong className={`font-sans ${isStale ? 'text-amber' : 'text-ink'}`}>{timeAgo(p.receivedAt, now)}</strong>
              </div>
            </div>

            {isStale && (
              <p className="text-[10px] text-amber leading-relaxed flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                Last position is over 30 minutes old — the vessel may be out of AIS range, or the tracking
                worker (<code className="font-mono">scripts/ais-worker.ts</code>) may be offline.
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
