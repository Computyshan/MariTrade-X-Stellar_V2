/**
 * lib/integrations/carrier-booking.ts
 *
 * Carrier booking API integration — Phase 5, Direct System Integration. Lets
 * a Freight Forwarder book vessel/container space through a carrier's own
 * booking API from inside MariTrade, so BOOKING_CONFIRMED /
 * SPACE_ON_VESSEL_SECURED can be backed by a system-verified booking
 * reference instead of a typed-in one.
 *
 * SANDBOX NOTE: Ocean carriers generally require a signed EDI/API
 * partnership agreement per carrier (Maersk, MSC, ONE, etc.) before any
 * sandbox credentials are issued — there's no generic public sandbox this
 * codebase can integrate against today. `SUPPORTED_CARRIERS` below lists the
 * carriers a deployment *could* wire up; `isCarrierConfigured()` checks
 * whether that carrier's env vars are actually set. Until they are, every
 * call returns `not_configured` and
 * app/api/shipments/[id]/carrier-booking/route.ts falls back to the
 * ordinary manual BOOKING_CONFIRMED / SPACE_ON_VESSEL_SECURED milestone flow.
 *
 * Required env vars per carrier once a real agreement exists (example for
 * Maersk):
 *   CARRIER_MAERSK_BASE_URL
 *   CARRIER_MAERSK_API_KEY
 */

import { IntegrationResult, notConfigured, ok, providerError } from './types';

/** Carriers this deployment could wire up. Adding a new one is a config-only
 *  change — no code change needed beyond adding its env var names here. */
export const SUPPORTED_CARRIERS: Record<string, { label: string; envPrefix: string }> = {
  MAERSK: { label: 'Maersk', envPrefix: 'CARRIER_MAERSK' },
  MSC: { label: 'MSC', envPrefix: 'CARRIER_MSC' },
  ONE: { label: 'Ocean Network Express', envPrefix: 'CARRIER_ONE' },
  COSCO: { label: 'COSCO Shipping', envPrefix: 'CARRIER_COSCO' },
};

export function isCarrierConfigured(carrierCode: string): boolean {
  const carrier = SUPPORTED_CARRIERS[carrierCode];
  if (!carrier) return false;
  return Boolean(
    process.env[`${carrier.envPrefix}_BASE_URL`] && process.env[`${carrier.envPrefix}_API_KEY`]
  );
}

export interface CarrierBookingParams {
  carrierCode: string;
  shipmentReferenceCode: string;
  originPort: string;
  destinationPort: string;
  containerType?: string;
  cargoDescription: string;
}

export interface CarrierBookingResponse {
  bookingReference: string;
  vesselName?: string;
  voyageNumber?: string;
}

/**
 * Request a booking from the named carrier. Returns `not_configured` if
 * `carrierCode` isn't in `SUPPORTED_CARRIERS` or that carrier's env vars
 * aren't set — callers must fall back to manual booking-reference entry.
 */
export async function requestCarrierBooking(
  params: CarrierBookingParams
): Promise<IntegrationResult<CarrierBookingResponse>> {
  const carrier = SUPPORTED_CARRIERS[params.carrierCode];
  if (!carrier || !isCarrierConfigured(params.carrierCode)) {
    return notConfigured(
      `No booking API credentials configured for carrier '${params.carrierCode}'.`
    );
  }

  const baseUrl = process.env[`${carrier.envPrefix}_BASE_URL`];
  const apiKey = process.env[`${carrier.envPrefix}_API_KEY`];

  try {
    const res = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        reference_code: params.shipmentReferenceCode,
        origin_port: params.originPort,
        destination_port: params.destinationPort,
        container_type: params.containerType,
        cargo_description: params.cargoDescription,
      }),
    });

    if (!res.ok) {
      return providerError(`${carrier.label} booking API returned HTTP ${res.status}: ${await res.text()}`);
    }

    const body = await res.json();
    return ok({
      bookingReference: body.booking_reference,
      vesselName: body.vessel_name ?? undefined,
      voyageNumber: body.voyage_number ?? undefined,
    });
  } catch (err: any) {
    return providerError(err?.message ?? `${carrier.label} booking request failed.`);
  }
}
