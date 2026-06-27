import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth-guard';
import { ConnectionRequest } from '@/types';

export async function GET(req: NextRequest) {
  // CRITICAL FIX: authenticate every request
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || '';

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const [users, connections] = await Promise.all([
      dbStore.getUsers(),
      dbStore.getConnectionRequestsForUser(userId),
    ]);

    const decorated = connections.map(c => {
      const otherPartyId = c.requesterId === userId ? c.receiverId : c.requesterId;
      const otherParty = users.find(u => u.id === otherPartyId) || null;
      return {
        ...c,
        otherParty,
        direction: c.requesterId === userId ? 'SENT' : 'RECEIVED',
      };
    });

    return NextResponse.json({ success: true, data: decorated });
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
    const { requesterId, receiverId } = body;

    if (!requesterId || !receiverId) {
      return NextResponse.json(
        { success: false, error: 'requesterId and receiverId are required' },
        { status: 400 }
      );
    }

    if (requesterId === receiverId) {
      return NextResponse.json({ success: false, error: 'Cannot connect to yourself' }, { status: 400 });
    }

    const [requester, receiver] = await Promise.all([
      dbStore.getUserById(requesterId),
      dbStore.getUserById(receiverId),
    ]);

    if (!requester || !receiver) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (receiver.kycStatus !== 'VERIFIED' && receiver.kycStatus !== 'SUBMITTED') {
      return NextResponse.json(
        { success: false, error: 'Receiver must have completed KYC onboarding' },
        { status: 400 }
      );
    }

    const allConns = await dbStore.getConnectionRequests();
    const existing = allConns.find(
      c =>
        (c.requesterId === requesterId && c.receiverId === receiverId) ||
        (c.requesterId === receiverId && c.receiverId === requesterId)
    );

    if (existing) {
      if (existing.status === 'PENDING' || existing.status === 'ACCEPTED') {
        return NextResponse.json(
          { success: false, error: 'A connection request already exists between these users' },
          { status: 409 }
        );
      }
      // REJECTED — delete the old row so a fresh request can be created
      if (existing.status === 'REJECTED') {
        const admin = getSupabaseAdmin();
        await admin.from('connection_requests').delete().eq('id', existing.id);
      }
    }

    const newConn: ConnectionRequest = {
      id: 'conn_' + Math.random().toString(36).substring(2, 10),
      requesterId,
      receiverId,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbStore.saveConnectionRequest(newConn);

    // Fire a notification to the receiver so it shows up in their bell + Pending tab
    try {
      await dbStore.saveNotification({
        id: 'notif_' + Math.random().toString(36).substring(2, 10),
        userId: receiverId,
        type: 'CONNECTION_REQUEST',
        title: 'New connection request',
        body: `${requester.fullName}${requester.companyName ? ' (' + requester.companyName + ')' : ''} wants to connect with you on MariNet.`,
        linkHref: '/network',
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    } catch (_) {
      // Non-fatal — connection was saved, notification failure shouldn't block the response
    }

    return NextResponse.json({ success: true, data: newConn }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
