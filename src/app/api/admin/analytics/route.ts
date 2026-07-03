import { NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/admin-guard';
import { getEvents } from '@/lib/analytics-store';
import { listUsers } from '@/lib/users-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdminAuthed('estatisticas'))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const [events, users] = await Promise.all([getEvents(), listUsers()]);
  // Envia eventos crus + usuários; o dashboard agrega por período no cliente.
  return NextResponse.json({ events, users });
}
