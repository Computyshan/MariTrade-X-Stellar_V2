import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { Message, ShipmentReceipt } from '@/types';
import { SUPPORTED_CURRENCIES } from '@/types';

async function isTradePartyOnlyThread(threadId: string): Promise<boolean> {
  const [participants, allUsers, thread] = await Promise.all([
    dbStore.getParticipantsForThread(threadId),
    dbStore.getUsers(),
    dbStore.getThreadById(threadId),
  ]);

  // FIX #8 — Group threads are never trade-party-only, regardless of member count
  if (thread?.isGroup) return false;

  const participantUsers = participants
    .map(p => allUsers.find(u => u.id === p.userId))
    .filter(Boolean);

  return (
    participantUsers.length === 2 &&
    participantUsers.every(u => u!.userType === 'TRADE_PARTY')
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // #1 — Auth guard
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const resolvedParams = await params;
    const { id: threadId } = resolvedParams;
    const thread = await dbStore.getThreadById(threadId);

    if (!thread) {
      return NextResponse.json({ success: false, error: 'Chat thread not found' }, { status: 404 });
    }

    const [messages, participants, allUsers, receipt, receiptHistory] = await Promise.all([
      dbStore.getMessages(threadId),
      dbStore.getParticipantsForThread(threadId),
      dbStore.getUsers(),
      dbStore.getReceiptByThreadId(threadId),
      dbStore.getReceiptsByThreadId(threadId),
    ]);

    const filledParticipants = participants.map(p => {
      const u = allUsers.find(usr => usr.id === p.userId);
      return {
        id: p.userId,
        fullName: u?.fullName || 'Unknown',
        jobRole: u?.jobRole || 'IMPORTER',
        companyName: u?.companyName || '',
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        thread,
        messages,
        participants: filledParticipants,
        receipt: receipt ?? null,
        // Full negotiation history for this thread, newest first — lets the UI
        // show past finalized receipts even after a New Receipt round starts.
        receiptHistory,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // #1 — Auth guard
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const resolvedParams = await params;
    const { id: threadId } = resolvedParams;
    const thread = await dbStore.getThreadById(threadId);

    if (!thread) {
      return NextResponse.json({ success: false, error: 'Chat thread not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action, senderId, content } = body;

    // FIX #1 — Verify senderId in body matches the authenticated JWT user
    if (senderId && senderId !== user!.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden — senderId does not match your session.' },
        { status: 403 }
      );
    }

    // Verify senderId is actually a participant in this thread
    const participants = await dbStore.getParticipantsForThread(threadId);
    const participantIds = participants.map(p => p.userId);
    if (senderId && !participantIds.includes(senderId)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden — you are not a participant in this thread.' },
        { status: 403 }
      );
    }

    if (action === 'FINALIZE_RECEIPT' || action === 'UPDATE_RECEIPT' || action === 'NEW_RECEIPT') {
      const tradePartyOnly = await isTradePartyOnlyThread(threadId);
      if (!tradePartyOnly) {
        return NextResponse.json(
          { success: false, error: 'Shipment Receipts are only available between Trade Party users.' },
          { status: 403 }
        );
      }
    }

    // ── Finalize the receipt: locks it for editing and surfaces it on the
    //    Create Shipment page so its fields can be used to prefill a new record.
    if (action === 'FINALIZE_RECEIPT') {
      const existing = await dbStore.getReceiptByThreadId(threadId);
      if (!existing) {
        return NextResponse.json({ success: false, error: 'No receipt to finalize yet — add some details first.' }, { status: 400 });
      }
      if (existing.status === 'FINALIZED') {
        return NextResponse.json({ success: false, error: 'This receipt has already been finalized.' }, { status: 400 });
      }

      const now = new Date().toISOString();
      const finalized: ShipmentReceipt = {
        ...existing,
        status: 'FINALIZED',
        finalizedById: senderId,
        finalizedAt: now,
        updatedAt: now,
      };
      await dbStore.saveReceipt(finalized);

      const updatedThread = { ...thread, status: 'RECEIPT_FINALIZED' as const, updatedAt: now };
      await dbStore.saveThread(updatedThread);

      const allUsers = await dbStore.getUsers();
      const sender = allUsers.find(u => u.id === senderId);
      const senderRole = sender ? sender.jobRole.replace(/_/g, ' ') : 'PARTNER';

      await dbStore.saveMessage({
        id: 'msg_sys_' + Math.random().toString(36).substring(2, 9),
        threadId: thread.id,
        senderId,
        content: `📋 ${senderRole} finalized the Shipment Receipt. It now appears on the Create Shipment page and can be used to prefill a new shipment record.`,
        createdAt: now,
      });

      return NextResponse.json({ success: true, data: { thread: updatedThread, receipt: finalized } });
    }

    // ── Start a fresh negotiation round: only allowed once the current
    //    receipt is FINALIZED. Creates a brand-new DRAFT receipt row (the
    //    finalized one stays untouched and remains in the thread's history),
    //    and flips the thread back to RECEIPT_DRAFT so the checklist re-opens.
    if (action === 'NEW_RECEIPT') {
      const existing = await dbStore.getReceiptByThreadId(threadId);
      if (!existing || existing.status !== 'FINALIZED') {
        return NextResponse.json(
          { success: false, error: 'A new receipt can only be started once the current one is finalized.' },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();
      const fresh: ShipmentReceipt = {
        id: 'rcpt_' + Math.random().toString(36).substring(2, 9),
        threadId,
        status: 'DRAFT',
        // Carry over the parties' contact info and route as a convenience
        // starting point for the next negotiation — everything else (cargo,
        // value, weight, dangerous goods, etc.) starts blank.
        importerContact: existing.importerContact,
        exporterContact: existing.exporterContact,
        originCountry: existing.originCountry,
        destCountry: existing.destCountry,
        invoiceCurrency: 'USD',
        weightUnit: 'KG',
        isDangerousGoods: false,
        lastEditedById: senderId,
        createdAt: now,
        updatedAt: now,
      };
      const saved = await dbStore.saveReceipt(fresh);

      const updatedThread = { ...thread, status: 'RECEIPT_DRAFT' as const, updatedAt: now };
      await dbStore.saveThread(updatedThread);

      const allUsers = await dbStore.getUsers();
      const sender = allUsers.find(u => u.id === senderId);
      const senderRole = sender ? sender.jobRole.replace(/_/g, ' ') : 'PARTNER';

      await dbStore.saveMessage({
        id: 'msg_sys_' + Math.random().toString(36).substring(2, 9),
        threadId: thread.id,
        senderId,
        content: `🆕 ${senderRole} started a new Shipment Receipt for another negotiation. The previous finalized receipt is still available in the receipt history.`,
        createdAt: now,
      });

      return NextResponse.json({ success: true, data: { thread: updatedThread, receipt: saved } });
    }

    // ── Update (or create) the draft receipt. Either Trade Party participant
    //    can edit it freely while it's still a DRAFT.
    if (action === 'UPDATE_RECEIPT') {
      const existing = await dbStore.getReceiptByThreadId(threadId);

      if (existing?.status === 'FINALIZED') {
        return NextResponse.json(
          { success: false, error: 'This receipt is finalized and can no longer be edited.' },
          { status: 403 }
        );
      }

      const {
        currency,
        invoiceValue,
        totalValueUSD,
        packageCount,
        grossWeight,
      } = body;

      // Validate currency against the fixed supported list — reject anything else
      if (currency !== undefined && !SUPPORTED_CURRENCIES.includes(currency)) {
        return NextResponse.json(
          { success: false, error: `Unsupported currency "${currency}". Must be one of: ${SUPPORTED_CURRENCIES.join(', ')}.` },
          { status: 400 }
        );
      }

      // Validate numeric fields when provided
      for (const [label, val] of [
        ['Invoice value', invoiceValue],
        ['Total value (USD)', totalValueUSD],
        ['Package count', packageCount],
        ['Gross weight', grossWeight],
      ] as const) {
        if (val !== undefined && val !== null && val !== '') {
          const parsed = Number(val);
          if (!Number.isFinite(parsed) || parsed < 0) {
            return NextResponse.json(
              { success: false, error: `${label} must be a valid non-negative number.` },
              { status: 400 }
            );
          }
        }
      }

      const now = new Date().toISOString();
      const merged: ShipmentReceipt = {
        id: existing?.id ?? 'rcpt_' + Math.random().toString(36).substring(2, 9),
        threadId,
        status: 'DRAFT',
        cargoDescription:  body.cargoDescription  !== undefined ? body.cargoDescription  : existing?.cargoDescription,
        shipmentScope:     body.shipmentScope      !== undefined ? body.shipmentScope      : existing?.shipmentScope,
        estimatedArrival:  body.estimatedArrival   !== undefined ? body.estimatedArrival   : existing?.estimatedArrival,
        importerContact:   body.importerContact    !== undefined ? body.importerContact    : existing?.importerContact,
        exporterContact:   body.exporterContact     !== undefined ? body.exporterContact     : existing?.exporterContact,
        originCountry:     body.originCountry      !== undefined ? body.originCountry      : existing?.originCountry,
        originAddress:     body.originAddress      !== undefined ? body.originAddress      : existing?.originAddress,
        originPort:        body.originPort         !== undefined ? body.originPort         : existing?.originPort,
        destCountry:       body.destCountry         !== undefined ? body.destCountry         : existing?.destCountry,
        destAddress:       body.destAddress         !== undefined ? body.destAddress         : existing?.destAddress,
        destinationPort:   body.destinationPort     !== undefined ? body.destinationPort     : existing?.destinationPort,
        invoiceCurrency:   currency                !== undefined ? currency                : (existing?.invoiceCurrency ?? 'USD'),
        invoiceValue:      invoiceValue             !== undefined ? Number(invoiceValue)     : existing?.invoiceValue,
        totalValueUSD:     totalValueUSD            !== undefined ? Number(totalValueUSD)    : existing?.totalValueUSD,
        hsCode:            body.hsCode              !== undefined ? body.hsCode              : existing?.hsCode,
        isDangerousGoods:  body.isDangerousGoods    !== undefined ? Boolean(body.isDangerousGoods) : (existing?.isDangerousGoods ?? false),
        packageCount:      packageCount             !== undefined ? Number(packageCount)     : existing?.packageCount,
        packagingType:     body.packagingType       !== undefined ? body.packagingType       : existing?.packagingType,
        grossWeight:       grossWeight              !== undefined ? Number(grossWeight)      : existing?.grossWeight,
        weightUnit:        body.weightUnit          !== undefined ? body.weightUnit          : (existing?.weightUnit ?? 'KG'),
        lastEditedById:    senderId,
        finalizedById:     existing?.finalizedById,
        finalizedAt:       existing?.finalizedAt,
        createdAt:         existing?.createdAt ?? now,
        updatedAt:         now,
      };
      const saved = await dbStore.saveReceipt(merged);

      // Keep the thread status + cargo blurb in sync for the sidebar preview
      const updatedThread = {
        ...thread,
        status: thread.status === 'RECEIPT_FINALIZED' ? thread.status : ('RECEIPT_DRAFT' as const),
        cargoDescription: saved.cargoDescription ?? thread.cargoDescription,
        updatedAt: now,
      };
      await dbStore.saveThread(updatedThread);

      return NextResponse.json({ success: true, data: { thread: updatedThread, receipt: saved } });
    }

    // Default: Send standard chat message
    if (!senderId || (!content && !body.imageUrl)) {
      return NextResponse.json(
        { success: false, error: 'SenderId and either Content or ImageUrl are required' },
        { status: 400 }
      );
    }

    const newMessage: Message = {
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      threadId: thread.id,
      senderId,
      content: content || '',
      imageUrl: body.imageUrl || undefined,
      createdAt: new Date().toISOString(),
    };

    await dbStore.saveMessage(newMessage);
    await dbStore.saveThread({ ...thread, updatedAt: new Date().toISOString() });

    // #5 — Fire MESSAGE_RECEIVED notification for each other participant
    const otherParticipants = participants.filter(p => p.userId !== senderId);
    await Promise.all(
      otherParticipants.map(p =>
        dbStore.saveNotification({
          id: 'notif_' + Math.random().toString(36).substring(2, 9),
          userId: p.userId,
          type: 'MESSAGE_RECEIVED',
          title: 'New message',
          body: content ? content.slice(0, 80) : '📷 Attachment',
          linkHref: `/messages?thread=${thread.id}`,
          isRead: false,
          createdAt: new Date().toISOString(),
        })
      )
    );

    return NextResponse.json({ success: true, data: newMessage });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // #1 — Auth guard
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const resolvedParams = await params;
    const { id: threadId } = resolvedParams;
    const messageId = req.nextUrl.searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json({ success: false, error: 'Message ID is required' }, { status: 400 });
    }

    const thread = await dbStore.getThreadById(threadId);
    if (!thread) {
      return NextResponse.json({ success: false, error: 'Chat thread not found' }, { status: 404 });
    }

    // #2 — Verify the caller is the original sender of this message
    const messages = await dbStore.getMessages(threadId);
    const targetMessage = messages.find(m => m.id === messageId);
    if (!targetMessage) {
      return NextResponse.json({ success: false, error: 'Message not found.' }, { status: 404 });
    }
    if (targetMessage.senderId !== user!.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden — you can only unsend your own messages.' },
        { status: 403 }
      );
    }

    await dbStore.unsendMessage(messageId);
    return NextResponse.json({ success: true, message: 'Message successfully unsent.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
