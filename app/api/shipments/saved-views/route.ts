import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { SavedShipmentView } from '@/types';

/**
 * GET /api/shipments/saved-views
 * Returns the authenticated user's saved Shipments-list filter/sort presets.
 */
export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const views = await dbStore.getSavedViewsForUser(user!.id);
    return NextResponse.json({ success: true, data: views });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/shipments/saved-views
 * Body: { name, filters, sortBy, sortDir }
 * Creates a new saved view owned by the authenticated user.
 */
export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { name, filters, sortBy, sortDir } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'A view name is required' }, { status: 400 });
    }

    const newView: SavedShipmentView = {
      id: 'view_' + Math.random().toString(36).substring(2, 9),
      userId: user!.id,
      name: name.trim(),
      filters: filters ?? {},
      sortBy: sortBy ?? 'createdAt',
      sortDir: sortDir ?? 'desc',
      createdAt: new Date().toISOString(),
    };

    const saved = await dbStore.saveSavedView(newView);
    return NextResponse.json({ success: true, data: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
