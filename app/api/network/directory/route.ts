import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { getUserJobRoles } from '@/types';

// CRITICAL FIX: authenticate every request
export async function GET(req: NextRequest) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const requesterId = searchParams.get('requesterId') || '';
    const search = (searchParams.get('search') || '').toLowerCase();

    const [users, allConnections] = await Promise.all([
      dbStore.getUsers(),
      requesterId ? dbStore.getConnectionRequestsForUser(requesterId) : Promise.resolve([]),
    ]);

    const members = users.filter(
      u =>
        u.id !== requesterId &&
        (u.kycStatus === 'VERIFIED' || u.kycStatus === 'SUBMITTED') &&
        (search === '' ||
          u.fullName.toLowerCase().includes(search) ||
          (u.companyName || '').toLowerCase().includes(search) ||
          getUserJobRoles(u).some(r => r.toLowerCase().includes(search)))
    );

    const decorated = members.map(m => {
      const conn = allConnections.find(
        c =>
          (c.requesterId === requesterId && c.receiverId === m.id) ||
          (c.receiverId === requesterId && c.requesterId === m.id)
      );
      return {
        ...m,
        connectionId: conn?.id ?? null,
        connectionStatus: conn?.status ?? null,
        isSender: conn ? conn.requesterId === requesterId : false,
      };
    });

    return NextResponse.json({ success: true, data: decorated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
