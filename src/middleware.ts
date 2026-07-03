import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from '@/lib/session';

// Caminhos que não exigem login de usuário (admin usa a senha mestra própria).
const PUBLIC_EXACT = ['/login'];
const PUBLIC_PREFIX = ['/api/auth', '/admin', '/api/admin', '/api/health'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  return PUBLIC_PREFIX.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const username = await verifySession(request.cookies.get('session')?.value);
  if (username) return NextResponse.next();

  if (pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = {
  // Aplica a tudo, exceto assets estáticos.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo-emserh.png).*)'],
};
