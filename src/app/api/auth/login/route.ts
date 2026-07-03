import { NextResponse } from 'next/server';
import { verifyLogin } from '@/lib/users-store';
import { signSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const username = typeof body?.username === 'string' ? body.username : '';
  const senha = typeof body?.senha === 'string' ? body.senha : '';

  const user = await verifyLogin(username, senha);
  if (!user) {
    return NextResponse.json({ error: 'Usuário ou senha incorretos' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, nome: user.nome });
  res.cookies.set('session', await signSession(user.username), {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/',
  });
  return res;
}
