import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { ChatThread, ChatParticipant } from '@/types';

export async function GET(req: NextRequest) {
  // CRITICAL FIX: authenticate every request
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'UserId query parameter is required' }, { status: 400 });
    }

    const [allThreads, allParticipants, allUsers] = await Promise.all([
      dbStore.getThreads(),
      dbStore.getParticipants(),
      dbStore.getUsers(),
    ]);

    // Filter threads where this user is active
    const userThreads = allThreads.filter(t => {
      const parts = allParticipants.filter(p => p.threadId === t.id);
      return parts.some(p => p.userId === userId);
    });

    // Re-fetch with per-thread messages for last message preview
    const threadsDecored = await Promise.all(
      userThreads.map(async thread => {
        const parts = allParticipants.filter(p => p.threadId === thread.id);
        const otherPart = parts.find(p => p.userId !== userId);
        const otherUser = otherPart ? allUsers.find(u => u.id === otherPart.userId) : null;

        const messages = await dbStore.getMessages(thread.id);
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

        return {
          ...thread,
          otherParticipant: otherUser
            ? {
                id: otherUser.id,
                fullName: otherUser.fullName,
                email: otherUser.email,
                jobRole: otherUser.jobRole,
                companyName: otherUser.companyName,
              }
            : null,
          lastMessage,
        };
      })
    );

    const sorted = threadsDecored.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return NextResponse.json({ success: true, data: sorted });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // CRITICAL FIX: authenticate every request
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { senderId, receiverId, initialMessage } = body;

    if (!senderId || !receiverId) {
      return NextResponse.json({ success: false, error: 'SenderId and ReceiverId are required' }, { status: 400 });
    }

    // ── Network guard ─────────────────────────────────────────────────────────
    const [senderUser, receiverUser] = await Promise.all([
      dbStore.getUserById(senderId),
      dbStore.getUserById(receiverId),
    ]);

    if (senderUser && receiverUser) {
      const isCrossParty =
        (senderUser.userType === 'TRADE_PARTY' && receiverUser.userType === 'LOGISTICS_CHAIN') ||
        (senderUser.userType === 'LOGISTICS_CHAIN' && receiverUser.userType === 'TRADE_PARTY');

      if (isCrossParty) {
        const allConns = await dbStore.getConnectionRequests();
        const hasAcceptedConnection = allConns.some(
          c =>
            c.status === 'ACCEPTED' &&
            ((c.requesterId === senderId && c.receiverId === receiverId) ||
              (c.requesterId === receiverId && c.receiverId === senderId))
        );

        if (!hasAcceptedConnection) {
          return NextResponse.json(
            {
              success: false,
              error: 'You can only message vendors in your Trusted Network. Connect with this user on the Network page first.',
              code: 'NOT_IN_NETWORK',
            },
            { status: 403 }
          );
        }
      }
    }

    const [allThreads, allParticipants] = await Promise.all([
      dbStore.getThreads(),
      dbStore.getParticipants(),
    ]);

    let threadId = '';
    const existingThread = allThreads.find(t => {
      const parts = allParticipants.filter(p => p.threadId === t.id);
      const hasSender = parts.some(p => p.userId === senderId);
      const hasReceiver = parts.some(p => p.userId === receiverId);
      return hasSender && hasReceiver;
    });

    if (existingThread) {
      threadId = existingThread.id;
    } else {
      threadId = 'thr_' + Math.random().toString(36).substring(2, 9);
      const newThread: ChatThread = {
        id: threadId,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await dbStore.saveThread(newThread);

      const p1: ChatParticipant = {
        id: 'cp_' + Math.random().toString(36).substring(2, 9),
        threadId,
        userId: senderId,
      };
      const p2: ChatParticipant = {
        id: 'cp_' + Math.random().toString(36).substring(2, 9),
        threadId,
        userId: receiverId,
      };
      await Promise.all([dbStore.saveParticipant(p1), dbStore.saveParticipant(p2)]);
    }

    if (initialMessage) {
      await dbStore.saveMessage({
        id: 'msg_' + Math.random().toString(36).substring(2, 9),
        threadId,
        senderId,
        content: initialMessage,
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, data: { threadId } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
