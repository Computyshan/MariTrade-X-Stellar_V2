import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { ConnectionRequest } from '@/types';

/**
 * GET /api/network/connections?userId=<id>
 * Returns all connection requests for a user (both sent and received),
 * with the other party's profile attached.
 *
 * POST /api/network/connections
 * Body: { requesterId, receiverId }
 * Sends a new connection request. Prevents duplicate pending/accepted requests.
 */

export async function GET(req: NextRequest) {
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

    if (receiver.userType !== 'LOGISTICS_CHAIN' || receiver.kycStatus !== 'VERIFIED') {
      return NextResponse.json(
        { success: false, error: 'Receiver must be a KYC-verified logistics vendor' },
        { status: 400 }
      );
    }

    // Check for existing connection (either direction)
    const allConns = await dbStore.getConnectionRequests();
    const existing = allConns.find(
      c =>
        (c.requesterId === requesterId && c.receiverId === receiverId) ||
        (c.requesterId === receiverId && c.receiverId === requesterId)
    );

    if (existing && (existing.status === 'PENDING' || existing.status === 'ACCEPTED')) {
      return NextResponse.json(
        { success: false, error: 'A connection request already exists between these users' },
        { status: 409 }
      );
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
    return NextResponse.json({ success: true, data: newConn }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
