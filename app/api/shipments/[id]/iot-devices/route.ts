/**
 * /api/shipments/[id]/iot-devices
 *
 * Phase 3 — IoT sensor ingestion, device registration side.
 *
 * A Logistics Chain user assigned to the shipment (or the platform) registers
 * a physical sensor tag (shock/humidity/GPS) against a shipment here. This
 * mints a device secret that the tag (or its gateway) then presents on every
 * webhook post to /api/iot/webhook — see that route for the ingestion side.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { IoTDevice } from '@/types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const shipment = await dbStore.getShipmentById(id);
  if (!shipment) {
    return NextResponse.json({ success: false, error: 'Shipment not found' }, { status: 404 });
  }
  const devices = await dbStore.getIoTDevicesForShipment(shipment.id);
  return NextResponse.json({ success: true, data: devices });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id: shipmentId } = await params;
    const body = await req.json();
    const { registeredById, deviceId, label } = body;

    if (!registeredById || !deviceId?.trim()) {
      return NextResponse.json(
        { success: false, error: 'registeredById and deviceId are required.' },
        { status: 400 }
      );
    }

    const shipment = await dbStore.getShipmentById(shipmentId);
    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment not found.' }, { status: 404 });
    }

    const registrant = await dbStore.getUserById(registeredById);
    if (!registrant) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    // Only assigned logistics chain members (or the importer) may register a
    // sensor tag against this shipment.
    const assignments = await dbStore.getAssignmentsForShipment(shipment.id);
    const isAssigned = assignments.some(a => a.userId === registeredById);
    const isImporter = shipment.importerId === registeredById;
    if (!isAssigned && !isImporter) {
      return NextResponse.json(
        { success: false, error: 'Only assigned logistics chain members or the importer may register sensor devices.' },
        { status: 403 }
      );
    }

    const deviceSecret = crypto.randomBytes(20).toString('hex');
    const device: IoTDevice & { deviceSecret: string } = {
      id: `iotd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shipmentId: shipment.id,
      deviceId: deviceId.trim(),
      label: label?.trim() || undefined,
      registeredById,
      createdAt: new Date().toISOString(),
      deviceSecret,
    };

    const saved = await dbStore.saveIoTDevice(device);

    // deviceSecret is only ever returned once, at registration time — it is
    // never stored in cleartext anywhere the client can re-fetch it, mirroring
    // how the Stellar platform secret key is handled (env-only, never re-served).
    return NextResponse.json({ success: true, data: { ...saved, deviceSecret } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
