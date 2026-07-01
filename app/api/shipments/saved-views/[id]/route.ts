import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

/**
 * DELETE /api/shipments/saved-views/[id]
 * Deletes a saved view. Scoped to the authenticated user — dbStore.deleteSavedView
 * filters by user_id, so this can't delete another user's view even if they
 * guess the id.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    await dbStore.deleteSavedView(id, user!.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
