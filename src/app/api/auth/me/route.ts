import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';
import { listUsers } from '@/lib/users-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const username = await verifySession(cookieStore.get('session')?.value);
  if (!username) return NextResponse.json({ user: null });
  const u = (await listUsers()).find((x) => x.username === username);
  return NextResponse.json({ user: { username, nome: u?.nome ?? username } });
}
