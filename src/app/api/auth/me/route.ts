import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';
import { listUsers } from '@/lib/users-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const email = await verifySession(cookieStore.get('session')?.value);
  if (!email) return NextResponse.json({ user: null });
  const u = (await listUsers()).find((x) => x.email === email);
  return NextResponse.json({ user: { email, nome: u?.nome ?? email, role: u?.role ?? null } });
}
