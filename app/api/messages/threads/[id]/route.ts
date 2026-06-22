import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { Message, ChatThreadStatus } from '@/types';

function isTradePartyOnlyThread(threadId: string): boolean {
  const participants = dbStore.getParticipantsForThread(threadId);
  const allUsers = dbStore.getUsers();
  const participantUsers = participants
    .map(p => allUsers.find(u => u.id === p.userId))
    .filter(Boolean);

  return participantUsers.length === 2 &&
    participantUsers.every(u => u!.userType === 'TRADE_PARTY');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id: threadId } = resolvedParams;
    const thread = dbStore.getThreadById(threadId);

    if (!thread) {
      return NextResponse.json({ success: false, error: 'Chat thread not found' }, { status: 404 });
    }

    const messages = dbStore.getMessages(threadId);
    const participants = dbStore.getParticipantsForThread(threadId);
    const allUsers = dbStore.getUsers();

    const filledParticipants = participants.map(p => {
      const u = allUsers.find(usr => usr.id === p.userId);
      return {
        id: p.userId,
        fullName: u?.fullName || 'Unknown',
        jobRole: u?.jobRole || 'IMPORTER',
        companyName: u?.companyName || ''
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        thread,
        messages,
        participants: filledParticipants
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id: threadId } = resolvedParams;
    const thread = dbStore.getThreadById(threadId);

    if (!thread) {
      return NextResponse.json({ success: false, error: 'Chat thread not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action, senderId, content, counterTerms } = body;

    // Action-based switches — escrow/counter offers are Trade Party to Trade Party only
    if (action === 'CONVERT_TO_SHIPMENT' || action === 'COUNTER_TERMS') {
      if (!isTradePartyOnlyThread(threadId)) {
        return NextResponse.json(
          { success: false, error: 'Escrow and counter offers are only available between Trade Party users.' },
          { status: 403 }
        );
      }
    }

    if (action === 'CONVERT_TO_SHIPMENT') {
      const updatedThread = {
        ...thread,
        status: 'DEAL_AGREED' as const,
        updatedAt: new Date().toISOString()
      };
      dbStore.saveThread(updatedThread);

      // Save a system message to indicate agreement
      dbStore.saveMessage({
        id: 'msg_sys_' + Math.random().toString(36).substring(2, 9),
        threadId: thread.id,
        senderId: senderId,
        content: `📈 IMPORTER clicked "Convert to Shipment". Initial deal terms agreed: Standard USDC Escrow protection requested. Draft shipment record created.`,
        createdAt: new Date().toISOString()
      });

      return NextResponse.json({ success: true, data: updatedThread });
    }

    if (action === 'COUNTER_TERMS') {
      const { currentCounterPriceUSD, cargoDescription } = body;
      const allUsers = dbStore.getUsers();
      const sender = allUsers.find(u => u.id === senderId);
      const senderRole = sender ? sender.jobRole.replace(/_/g, ' ') : 'PARTNER';

      const updatedThread = {
        ...thread,
        status: 'COUNTER_OFFER' as const,
        currentCounterPriceUSD: currentCounterPriceUSD !== undefined ? Number(currentCounterPriceUSD) : thread.currentCounterPriceUSD,
        cargoDescription: cargoDescription !== undefined ? cargoDescription : thread.cargoDescription,
        updatedAt: new Date().toISOString()
      };
      dbStore.saveThread(updatedThread);

      // Save a system message with terms description
      dbStore.saveMessage({
        id: 'msg_sys_' + Math.random().toString(36).substring(2, 9),
        threadId: thread.id,
        senderId: senderId,
        content: `⚠️ ${senderRole} submitted a Counter Offer: $${(currentCounterPriceUSD || 0).toLocaleString()} USDC - "${cargoDescription || 'Industrial Commodities'}". Waiting for acceptance.`,
        createdAt: new Date().toISOString()
      });

      return NextResponse.json({ success: true, data: updatedThread });
    }

    // Default: Send standard chat message (allows content or imageUrl)
    if (!senderId || (!content && !body.imageUrl)) {
      return NextResponse.json({ success: false, error: 'SenderId and either Content or ImageUrl are required' }, { status: 400 });
    }

    const newMessage: Message = {
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      threadId: thread.id,
      senderId,
      content: content || '',
      imageUrl: body.imageUrl || undefined,
      createdAt: new Date().toISOString()
    };

    dbStore.saveMessage(newMessage);

    // Update thread updated timestamp
    dbStore.saveThread({
      ...thread,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true, data: newMessage });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id: threadId } = resolvedParams;
    const messageId = req.nextUrl.searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json({ success: false, error: 'Message ID is required' }, { status: 400 });
    }

    const thread = dbStore.getThreadById(threadId);
    if (!thread) {
      return NextResponse.json({ success: false, error: 'Chat thread not found' }, { status: 404 });
    }

    dbStore.unsendMessage(messageId);

    return NextResponse.json({ success: true, message: 'Message successfully unsent.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
