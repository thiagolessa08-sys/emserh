import { NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/admin-guard';
import { getAnalytics } from '@/lib/analytics-store';
import { listUsers } from '@/lib/users-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdminAuthed('estatisticas'))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const [analytics, users] = await Promise.all([getAnalytics(), listUsers()]);
  const nomes: Record<string, string> = {};
  for (const u of users) nomes[u.username] = u.nome;
  return NextResponse.json({ analytics, nomes });
}
