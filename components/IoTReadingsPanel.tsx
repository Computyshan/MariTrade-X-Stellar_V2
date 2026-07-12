'use client';

/**
 * components/IoTReadingsPanel.tsx
 *
 * Phase 3 — IoT sensor ingestion, display side.
 *
 * The backend for this item was already fully built (types/index.ts —
 * IoTDevice/IoTSensorReading; lib/db.ts — device + reading CRUD and the
 * milestone-linking backfill; app/api/iot/webhook — device-authenticated
 * ingestion; app/api/shipments/[id]/iot-devices and .../iot-readings), but
 * nothing on the shipment detail page ever surfaced it. This is that
 * missing piece: a card showing the latest reading per sensor type, a
 * recent-activity log, and (for assigned logistics users / the importer)
 * a way to register a new sensor tag and retrieve its one-time device
 * secret. Mirrors VesselPositionCard's polling + state-machine pattern.
 *
 * Deliberately does NOT invent "safe range" thresholds for temperature,
 * humidity, or shock — those are cargo-specific and nothing in the schema
 * defines them. The panel presents readings neutrally (value, unit, time,
 * whether they corroborate a logged milestone) and leaves interpretation
 * to the human, same posture as the Gemini "suggestion, not decision"
 * features elsewhere in this codebase. The one thing it does flag on its
 * own is a DOOR_OPEN reading, since an open-door event is unambiguous
 * regardless of cargo type.
 */

import { useEffect, useState, useCallback, FormEvent } from 'react';
import {
  Radio, RefreshCw, AlertTriangle, Thermometer, Droplets, Zap, MapPin,
  DoorOpen, Cpu, Plus, Copy, CheckCircle2, ShieldCheck, X,
} from 'lucide-react';
import { authFetch } from '@/hooks/use-user-session';
import { IoTDevice, IoTReadingType, IoTSensorReading } from '@/types';

const POLL_INTERVAL_MS = 30_000;
const RECENT_LOG_LIMIT = 15;

type ReadingsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; readings: IoTSensorReading[] };

const READING_META: Record<IoTReadingType, { label: string; Icon: typeof Thermometer }> = {
  TEMPERATURE: { label: 'Temperature', Icon: Thermometer },
  HUMIDITY:    { label: 'Humidity',    Icon: Droplets },
  SHOCK:       { label: 'Shock',       Icon: Zap },
  GPS:         { label: 'GPS',         Icon: MapPin },
  DOOR_OPEN:   { label: 'Door',        Icon: DoorOpen },
};

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

export default function IoTReadingsPanel({
  shipmentId,
  currentUserId,
  canRegisterDevice,
}: {
  shipmentId: string;
  currentUserId: string;
  /** Mirrors the /api/shipments/[id]/iot-devices POST check: only an
   *  assigned logistics chain member or the importer may register a
   *  sensor tag. The GET below is open to any authenticated viewer on
   *  the shipment (same visibility as milestones), same as the API. */
  canRegisterDevice: boolean;
}) {
  const [state, setState] = useState<ReadingsState>({ status: 'loading' });
  const [devices, setDevices] = useState<IoTDevice[]>([]);
  const [devicesLoaded, setDevicesLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // ── Register-device modal ────────────────────────────────────────────
  const [registerOpen, setRegisterOpen] = useState(false);
  const [deviceIdInput, setDeviceIdInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  // Shown exactly once, right after a successful registration — the API
  // never re-serves a device's secret after this response.
  const [justRegisteredSecret, setJustRegisteredSecret] = useState<{ deviceId: string; secret: string } | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);

  const fetchReadings = useCallback(async (silent = false) => {
    if (!silent) setState({ status: 'loading' });
    try {
      const res = await authFetch(`/api/shipments/${shipmentId}/iot-readings`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setState(s => (s.status === 'ok' ? s : { status: 'error', message: json.error || 'Could not load sensor readings.' }));
        return;
      }
      setState({ status: 'ok', readings: json.data as IoTSensorReading[] });
    } catch {
      setState(s => (s.status === 'ok' ? s : { status: 'error', message: 'Could not reach the sensor feed.' }));
    }
  }, [shipmentId]);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await authFetch(`/api/shipments/${shipmentId}/iot-devices`);
      const json = await res.json();
      if (json.success) setDevices(json.data as IoTDevice[]);
    } catch {
      // Non-critical — the readings panel still works without the device list.
    } finally {
      setDevicesLoaded(true);
    }
  }, [shipmentId]);

  useEffect(() => {
    const initialTimer = setTimeout(() => { fetchReadings(); fetchDevices(); }, 0);
    const pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') fetchReadings(true);
    }, POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchReadings(true);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchReadings, fetchDevices]);

  useEffect(() => {
    const tickTimer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(tickTimer);
  }, []);

  const openRegisterModal = () => {
    setDeviceIdInput('');
    setLabelInput('');
    setRegisterError('');
    setJustRegisteredSecret(null);
    setSecretCopied(false);
    setRegisterOpen(true);
  };

  const handleRegisterDevice = async (e: FormEvent) => {
    e.preventDefault();
    if (!deviceIdInput.trim()) return;
    setRegistering(true);
    setRegisterError('');
    try {
      const res = await authFetch(`/api/shipments/${shipmentId}/iot-devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registeredById: currentUserId,
          deviceId: deviceIdInput.trim(),
          label: labelInput.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setJustRegisteredSecret({ deviceId: json.data.deviceId, secret: json.data.deviceSecret });
        fetchDevices();
      } else {
        setRegisterError(json.error || 'Failed to register device.');
      }
    } catch {
      setRegisterError('Network error — please try again.');
    } finally {
      setRegistering(false);
    }
  };

  const handleCopySecret = async () => {
    if (!justRegisteredSecret) return;
    try {
      await navigator.clipboard.writeText(justRegisteredSecret.secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      // Clipboard permission denied — the secret is still visible to copy manually.
    }
  };

  // ── Derive latest-per-type snapshot from the (already recorded_at-desc) list
  const readings = state.status === 'ok' ? state.readings : [];
  const latestByType = new Map<IoTReadingType, IoTSensorReading>();
  for (const r of readings) {
    if (!latestByType.has(r.readingType)) latestByType.set(r.readingType, r);
  }
  const recentDoorOpen = readings.find(r => r.readingType === 'DOOR_OPEN');
  const recentLog = readings.slice(0, RECENT_LOG_LIMIT);

  return (
    <div className="bg-white border border-mist p-6 rounded-2xl shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-extrabold text-sm text-ink tracking-tight flex items-center gap-2">
          <Radio className="w-5 h-5 text-steel" /><span>Cargo Sensor Readings</span>
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          {state.status === 'ok' && readings.length > 0 && (
            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-teal">
              <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" /> Live
            </span>
          )}
          {canRegisterDevice && (
            <button
              type="button"
              onClick={openRegisterModal}
              className="flex items-center gap-1 text-[10px] font-bold text-steel hover:text-teal border border-steel-light hover:border-teal-light bg-steel-light/40 hover:bg-teal-light px-2.5 py-1.5 rounded-lg transition-all"
            >
              <Plus className="w-3 h-3" /> Register Sensor
            </button>
          )}
        </div>
      </div>

      {devicesLoaded && devices.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {devices.map(d => (
            <span key={d.id} className="flex items-center gap-1 text-[9px] font-bold text-ink-faint bg-mist-light border border-mist px-2 py-1 rounded-full">
              <Cpu className="w-3 h-3" /> {d.label || d.deviceId}
            </span>
          ))}
        </div>
      )}

      {state.status === 'loading' && (
        <div className="flex items-center gap-1.5 text-[11px] text-ink-faint py-6 justify-center">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Checking for sensor data…
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex items-start gap-1.5 text-[11px] text-wine bg-wine-light border border-wine/20 rounded-lg px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {state.message}
        </div>
      )}

      {state.status === 'ok' && readings.length === 0 && (
        <div className="flex items-start gap-1.5 text-[11px] text-ink-faint bg-mist-light border border-mist rounded-lg px-3 py-2.5">
          <Cpu className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            {devicesLoaded && devices.length === 0
              ? <>No sensor tags registered on this shipment yet.{canRegisterDevice ? ' Register one above to start receiving temperature, humidity, shock, GPS, or door-open readings.' : ''}</>
              : 'No readings received yet from the registered sensor tag(s). Readings appear here automatically once a device posts to the ingestion endpoint.'}
          </span>
        </div>
      )}

      {state.status === 'ok' && readings.length > 0 && (
        <div className="space-y-3">
          {recentDoorOpen && (
            <div className="flex items-start gap-1.5 text-[10px] text-amber bg-amber-light border border-amber-light rounded-lg px-2.5 py-2">
              <DoorOpen className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Door-open event recorded {timeAgo(recentDoorOpen.recordedAt, now)} — verify this lines up with an expected handling step.</span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
            {Array.from(latestByType.entries()).map(([type, r]) => {
              const meta = READING_META[type];
              const Icon = meta.Icon;
              return (
                <div key={type} className="bg-mist-light border border-mist rounded-lg p-2.5 space-y-0.5">
                  <span className="text-[9px] text-ink-faint font-bold uppercase tracking-wide flex items-center gap-1">
                    <Icon className="w-3 h-3" /> {meta.label}
                  </span>
                  <strong className="text-ink font-sans block">
                    {type === 'GPS'
                      ? (r.latitude != null && r.longitude != null ? `${r.latitude.toFixed(3)}°, ${r.longitude.toFixed(3)}°` : '—')
                      : type === 'DOOR_OPEN'
                      ? (r.value ? 'Open' : 'Closed')
                      : `${r.value}${r.unit ? ` ${r.unit}` : ''}`}
                  </strong>
                  <span className="text-[9px] text-ink-faint block">{timeAgo(r.recordedAt, now)}</span>
                </div>
              );
            })}
          </div>

          <div className="space-y-1.5 pt-1">
            <h4 className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Recent Activity</h4>
            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
              {recentLog.map(r => {
                const meta = READING_META[r.readingType];
                const Icon = meta.Icon;
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-[10px] border border-mist rounded-lg px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon className="w-3 h-3 text-steel flex-shrink-0" />
                      <span className="font-bold text-ink truncate">
                        {r.readingType === 'GPS'
                          ? (r.latitude != null && r.longitude != null ? `${r.latitude.toFixed(3)}°, ${r.longitude.toFixed(3)}°` : 'GPS')
                          : r.readingType === 'DOOR_OPEN'
                          ? (r.value ? 'Door opened' : 'Door closed')
                          : `${r.value}${r.unit ? ` ${r.unit}` : ''}`}
                      </span>
                      {r.milestoneEventId && (
                        <span className="flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wide text-teal bg-teal-light border border-steel-light px-1 py-0.5 rounded shrink-0">
                          <ShieldCheck className="w-2.5 h-2.5" /> Linked
                        </span>
                      )}
                    </div>
                    <span className="text-ink-faint shrink-0">{timeAgo(r.recordedAt, now)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Register Sensor Modal ─────────────────────────────────────── */}
      {registerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-mist rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-steel-light rounded-xl flex items-center justify-center shrink-0">
                <Cpu className="w-5 h-5 text-steel" />
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-sm text-ink">Register Sensor Tag</h3>
                <p className="text-[10px] text-ink-faint font-sans">Shock, humidity, GPS, or door tags</p>
              </div>
              <button
                onClick={() => setRegisterOpen(false)}
                className="text-ink-faint hover:text-ink"
              ><X className="w-4 h-4" /></button>
            </div>

            {registerError && (
              <div className="bg-wine-light border border-wine/20 text-wine text-xs p-2.5 rounded-lg flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />{registerError}
              </div>
            )}

            {justRegisteredSecret ? (
              <div className="space-y-3">
                <div className="bg-amber-light border border-amber/30 text-ink text-[11px] p-3 rounded-lg leading-relaxed flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber flex-shrink-0 mt-0.5" />
                  <span>This device secret is shown <strong>once</strong> and can&apos;t be retrieved again. Copy it into the sensor&apos;s
                    configuration now — you&apos;ll need to re-register a replacement device if it&apos;s lost.</span>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-ink-faint uppercase tracking-wide">Device ID</label>
                  <div className="font-mono text-[11px] bg-mist-light border border-mist rounded-lg px-3 py-2 text-ink truncate">{justRegisteredSecret.deviceId}</div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-ink-faint uppercase tracking-wide">Device Secret</label>
                  <div className="flex items-center gap-2 bg-mist-light border border-mist rounded-lg px-3 py-2">
                    <span className="font-mono text-[10px] text-ink truncate flex-1">{justRegisteredSecret.secret}</span>
                    <button type="button" onClick={handleCopySecret} className="shrink-0 text-ink-faint hover:text-teal">
                      {secretCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-teal" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button onClick={() => setRegisterOpen(false)} className="px-4 py-2 bg-amber hover:bg-ink text-white rounded-lg font-bold text-xs transition-all">Done</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterDevice} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="block font-bold text-ink-faint text-[10px] uppercase tracking-wide">Device ID <span className="text-wine">*</span></label>
                  <input type="text" required value={deviceIdInput} onChange={e => setDeviceIdInput(e.target.value)}
                    placeholder="e.g. serial number printed on the tag"
                    className="w-full border border-mist rounded-lg p-2.5 text-xs outline-none focus:border-teal font-mono" />
                </div>
                <div className="space-y-1.5">
                  <label className="block font-bold text-ink-faint text-[10px] uppercase tracking-wide">Label</label>
                  <input type="text" value={labelInput} onChange={e => setLabelInput(e.target.value)}
                    placeholder="Optional — e.g. Container 3 door sensor"
                    className="w-full border border-mist rounded-lg p-2.5 text-xs outline-none focus:border-teal" />
                </div>
                <p className="text-[10px] text-ink-faint leading-relaxed">
                  A device secret will be generated for this tag to authenticate its posts to MariTrade&apos;s ingestion endpoint.
                </p>
                <div className="flex gap-2 justify-end pt-2">
                  <button type="button" className="px-3 py-1.5 border border-mist rounded-lg text-ink-faint font-bold"
                    onClick={() => setRegisterOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" disabled={registering || !deviceIdInput.trim()}
                    className="px-4 py-1.5 bg-steel hover:bg-teal text-white rounded-lg font-black disabled:opacity-50 flex items-center gap-1.5">
                    {registering ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Registering…</> : <><Plus className="w-3.5 h-3.5" /> Register</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
