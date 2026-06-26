import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';

/**
 * GET /api/network/directory?requesterId=<userId>
 *
 * Returns all VERIFIED logistics-chain users (Customs Brokers & Freight Forwarders),
 * each decorated with the current connection status relative to the requester.
 *
 * Accessible to any authenticated user so Importers can browse the full directory.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requesterId = searchParams.get('requesterId') || '';
    const search = (searchParams.get('search') || '').toLowerCase();

    const [users, allConnections] = await Promise.all([
      dbStore.getUsers(),
      requesterId ? dbStore.getConnectionRequestsForUser(requesterId) : Promise.resolve([]),
    ]);

    // Only expose VERIFIED logistics vendors in the public directory
    const vendors = users.filter(
      u =>
        u.userType === 'LOGISTICS_CHAIN' &&
        u.kycStatus === 'VERIFIED' &&
        (search === '' ||
          u.fullName.toLowerCase().includes(search) ||
          (u.companyName || '').toLowerCase().includes(search) ||
          u.jobRole.toLowerCase().includes(search))
    );

    const decorated = vendors.map(v => {
      const conn = allConnections.find(
        c =>
          (c.requesterId === requesterId && c.receiverId === v.id) ||
          (c.receiverId === requesterId && c.requesterId === v.id)
      );
      return {
        ...v,
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
