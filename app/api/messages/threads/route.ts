import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { ChatThread, ChatParticipant } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'UserId query parameter is required' }, { status: 400 });
    }

    const allThreads = dbStore.getThreads();
    const allParticipants = dbStore.getParticipants();
    const allUsers = dbStore.getUsers();

    // Filter threads where this user is active
    const userThreads = allThreads.filter(t => {
      const parts = allParticipants.filter(p => p.threadId === t.id);
      return parts.some(p => p.userId === userId);
    });

    const threadsWithDetails = userThreads
      .map(thread => {
      // Find other participant
      const parts = allParticipants.filter(p => p.threadId === thread.id);
      const otherPart = parts.find(p => p.userId !== userId);
      const otherUser = otherPart ? allUsers.find(u => u.id === otherPart.userId) : null;
      
      const messages = dbStore.getMessages(thread.id);
      const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

      return {
        ...thread,
        otherParticipant: otherUser ? {
          id: otherUser.id,
          fullName: otherUser.fullName,
          email: otherUser.email,
          jobRole: otherUser.jobRole,
          companyName: otherUser.companyName
        } : null,
        lastMessage
      };
    })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({ success: true, data: threadsWithDetails });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { senderId, receiverId, initialMessage } = body;

    if (!senderId || !receiverId) {
      return NextResponse.json({ success: false, error: 'SenderId and ReceiverId are required' }, { status: 400 });
    }

    // Check if an open thread already exists between these two
    const allThreads = dbStore.getThreads();
    const allParticipants = dbStore.getParticipants();

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
      // Create new thread
      threadId = 'thr_' + Math.random().toString(36).substring(2, 9);
      const newThread: ChatThread = {
        id: threadId,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      dbStore.saveThread(newThread);

      // Create participants
      const p1: ChatParticipant = {
        id: 'cp_' + Math.random().toString(36).substring(2, 9),
        threadId,
        userId: senderId
      };
      const p2: ChatParticipant = {
        id: 'cp_' + Math.random().toString(36).substring(2, 9),
        threadId,
        userId: receiverId
      };
      dbStore.saveParticipant(p1);
      dbStore.saveParticipant(p2);
    }

    // Save initial message if present
    if (initialMessage) {
      dbStore.saveMessage({
        id: 'msg_' + Math.random().toString(36).substring(2, 9),
        threadId,
        senderId,
        content: initialMessage,
        createdAt: new Date().toISOString()
      });
    }

    return NextResponse.json({ success: true, data: { threadId } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
