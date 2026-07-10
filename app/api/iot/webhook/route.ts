/**
 * /api/iot/webhook
 *
 * Phase 3 — IoT sensor ingestion, inbound side.
 *
 * Public endpoint (no user session — the caller is a device/gateway, not a
 * browser) authenticated instead by deviceId + deviceSecret minted at
 * registration time (see /api/shipments/[id]/iot-devices). This mirrors how
 * the platform Stellar keypair authenticates server-to-server calls elsewhere
 * in this codebase — a shared secret, not a user JWT.
 *
 * Body: {
 *   deviceId: string,
 *   deviceSecret: string,
 *   readingType: 'TEMPERATURE'|'HUMIDITY'|'SHOCK'|'GPS'|'DOOR_OPEN',
 *   value: number,
 *   unit: string,
 *   latitude?: number,
 *   longitude?: number,
 *   recordedAt?: string,   // defaults to now
 * }
 *
 * Readings are stored unlinked to any milestone at ingestion time; the
 * milestone POST route backfills the link (±6h window) once a matching
 * milestone is logged — see app/api/shipments/[id]/milestones/route.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { IoTReadingType, IoTSensorReading } from '@/types';

const VALID_READING_TYPES: IoTReadingType[] = ['TEMPERATURE', 'HUMIDITY', 'SHOCK', 'GPS', 'DOOR_OPEN'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deviceId, deviceSecret, readingType, value, unit, latitude, longitude, recordedAt } = body;

    if (!deviceId || !deviceSecret) {
      return NextResponse.json({ success: false, error: 'deviceId and deviceSecret are required.' }, { status: 400 });
    }
    if (!VALID_READING_TYPES.includes(readingType)) {
      return NextResponse.json(
        { success: false, error: `readingType must be one of ${VALID_READING_TYPES.join(', ')}.` },
        { status: 400 }
      );
    }
    if (typeof value !== 'number' || !unit) {
      return NextResponse.json({ success: false, error: 'value (number) and unit are required.' }, { status: 400 });
    }

    // Device authentication — deliberately identical error for "unknown
    // device" and "wrong secret" so this endpoint never leaks which devices
    // exist to a caller who doesn't already have credentials for one.
    const device = await dbStore.getIoTDeviceByIdAndSecret(deviceId, deviceSecret);
    if (!device) {
      return NextResponse.json({ success: false, error: 'Invalid device credentials.' }, { status: 401 });
    }

    const reading: IoTSensorReading = {
      id: `iotr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shipmentId: device.shipmentId,
      deviceId,
      readingType,
      value,
      unit,
      latitude: typeof latitude === 'number' ? latitude : undefined,
      longitude: typeof longitude === 'number' ? longitude : undefined,
      recordedAt: recordedAt ?? new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const saved = await dbStore.saveIoTReading(reading);
    return NextResponse.json({ success: true, data: saved });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
