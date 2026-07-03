import { NextResponse } from 'next/server';
import { checkPassword, makeAuthToken, adminCookieName, type AdminArea } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const AREAS: AdminArea[] = ['regras', 'usuarios', 'estatisticas'];

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const area: AdminArea = AREAS.includes(body?.area) ? body.area : 'regras';
  const senha = typeof body?.senha === 'string' ? body.senha : '';

  if (!checkPassword(area, senha)) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminCookieName(area), makeAuthToken(area), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return res;
}
