import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';

export async function GET() {
  try {
    const users = await dbStore.getUsers();
    return NextResponse.json({ success: true, data: users });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
