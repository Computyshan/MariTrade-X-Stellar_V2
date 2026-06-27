import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

/**
 * GET /api/shipments/receipts?userId=...
 *
 * Returns the FINALIZED Shipment Receipts from chats the requesting user
 * participates in. Used by the "Create Shipment" page to show a picker of
 * receipts that can prefill the new shipment form, decorated with the other
 * thread participant so the picker can show who it was finalized with.
 */
export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const userId = req.nextUrl.searchParams.get('userId') || user!.id;

    // FIX — only allow a user to fetch their own receipts
    if (userId !== user!.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden — you can only view your own receipts.' },
        { status: 403 }
      );
    }

    const [receipts, allUsers] = await Promise.all([
      dbStore.getFinalizedReceiptsForUser(userId),
      dbStore.getUsers(),
    ]);

    const decorated = await Promise.all(
      receipts.map(async receipt => {
        const participants = await dbStore.getParticipantsForThread(receipt.threadId);
        const otherParticipant = participants
          .map(p => allUsers.find(u => u.id === p.userId))
          .find(u => u && u.id !== userId);

        return {
          ...receipt,
          counterparty: otherParticipant
            ? {
                id: otherParticipant.id,
                fullName: otherParticipant.fullName,
                companyName: otherParticipant.companyName,
                jobRole: otherParticipant.jobRole,
              }
            : null,
        };
      })
    );

    return NextResponse.json({ success: true, data: decorated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
