/**
 * lib/integrations/boc-e2m.ts
 *
 * BOC (Bureau of Customs) e2m / customs EDI integration — Phase 5, Direct
 * System Integration. Lets a Customs Broker file the entry and pay duties
 * *through* MariTrade instead of doing it on BOC's own e2m portal and then
 * pasting a reference number back in.
 *
 * SANDBOX NOTE: There is no public e2m sandbox this codebase can reach from
 * here — BOC's e2m gateway is a closed government system requiring an
 * accredited-broker account and a formal integration agreement. The
 * functions below are the real call shape the app is built against; until
 * BOC credentials exist for a deployment, `isBocE2mConfigured()` returns
 * false and every call here returns `not_configured`, so
 * app/api/shipments/[id]/boc-filing/route.ts falls back to the ordinary
 * manual BOC_ENTRY_FILED / DUTIES_AND_TAXES_PAID milestone flow.
 *
 * Required env vars once a real sandbox/production agreement exists:
 *   BOC_E2M_BASE_URL   — e.g. https://e2m.customs.gov.ph/api/v1
 *   BOC_E2M_API_KEY    — accredited broker's API key
 *   BOC_E2M_CLIENT_ID  — accredited broker's client/account id
 */

import { IntegrationResult, notConfigured, ok, providerError } from './types';

function isBocE2mConfigured(): boolean {
  return Boolean(
    process.env.BOC_E2M_BASE_URL &&
    process.env.BOC_E2M_API_KEY &&
    process.env.BOC_E2M_CLIENT_ID
  );
}

export interface BocEntryFilingParams {
  shipmentReferenceCode: string;
  hsCode?: string;
  cargoDescription: string;
  totalValueUSD: number;
  originCountry: string;
}

export interface BocEntryFilingResponse {
  entrySeriesNumber: string;
  dutiesAssessedUSD: number;
}

/**
 * Submit an import entry declaration to BOC e2m. Returns `not_configured`
 * if the deployment has no e2m credentials — callers must fall back to
 * accepting a manually-typed entry series number on the BOC_ENTRY_FILED
 * milestone in that case, exactly as before Phase 5.
 */
export async function submitBocEntryFiling(
  params: BocEntryFilingParams
): Promise<IntegrationResult<BocEntryFilingResponse>> {
  if (!isBocE2mConfigured()) {
    return notConfigured('BOC_E2M_BASE_URL / BOC_E2M_API_KEY / BOC_E2M_CLIENT_ID not set.');
  }

  try {
    const res = await fetch(`${process.env.BOC_E2M_BASE_URL}/entries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.BOC_E2M_API_KEY}`,
        'X-Client-Id': process.env.BOC_E2M_CLIENT_ID!,
      },
      body: JSON.stringify({
        reference_code: params.shipmentReferenceCode,
        hs_code: params.hsCode,
        cargo_description: params.cargoDescription,
        total_value_usd: params.totalValueUSD,
        origin_country: params.originCountry,
      }),
    });

    if (!res.ok) {
      return providerError(`BOC e2m returned HTTP ${res.status}: ${await res.text()}`);
    }

    const body = await res.json();
    return ok({
      entrySeriesNumber: body.entry_series_number,
      dutiesAssessedUSD: Number(body.duties_assessed_usd),
    });
  } catch (err: any) {
    return providerError(err?.message ?? 'BOC e2m request failed.');
  }
}

export interface BocDutyPaymentParams {
  entrySeriesNumber: string;
  amountUSD: number;
}

export interface BocDutyPaymentResponse {
  officialReceiptNumber: string;
}

/**
 * Confirm duty payment against a filed entry. Same graceful-degradation
 * contract as submitBocEntryFiling — falls back to an uploaded Official
 * Receipt on the DUTIES_AND_TAXES_PAID milestone if not configured.
 */
export async function submitBocDutyPayment(
  params: BocDutyPaymentParams
): Promise<IntegrationResult<BocDutyPaymentResponse>> {
  if (!isBocE2mConfigured()) {
    return notConfigured('BOC_E2M_BASE_URL / BOC_E2M_API_KEY / BOC_E2M_CLIENT_ID not set.');
  }

  try {
    const res = await fetch(
      `${process.env.BOC_E2M_BASE_URL}/entries/${encodeURIComponent(params.entrySeriesNumber)}/payments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.BOC_E2M_API_KEY}`,
          'X-Client-Id': process.env.BOC_E2M_CLIENT_ID!,
        },
        body: JSON.stringify({ amount_usd: params.amountUSD }),
      }
    );

    if (!res.ok) {
      return providerError(`BOC e2m returned HTTP ${res.status}: ${await res.text()}`);
    }

    const body = await res.json();
    return ok({ officialReceiptNumber: body.official_receipt_number });
  } catch (err: any) {
    return providerError(err?.message ?? 'BOC e2m request failed.');
  }
}

export { isBocE2mConfigured };
