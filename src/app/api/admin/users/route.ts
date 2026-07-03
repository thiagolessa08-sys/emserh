import { NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/admin-guard';
import { listUsers, createUser, deleteUser, CreateUserSchema } from '@/lib/users-store';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdminAuthed('usuarios'))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  return NextResponse.json({ users: await listUsers() });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthed('usuarios'))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.issues }, { status: 400 });
  try {
    await createUser(parsed.data.nome, parsed.data.username, parsed.data.senha);
  } catch (err) {
    if (err instanceof Error && err.message === 'DUPLICATE') {
      return NextResponse.json({ error: 'Já existe um usuário com esse login' }, { status: 409 });
    }
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'user_create_failed');
    return NextResponse.json({ error: 'Falha ao criar usuário' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthed('usuarios'))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  if (!username) return NextResponse.json({ error: 'username ausente' }, { status: 400 });
  await deleteUser(username);
  return NextResponse.json({ ok: true });
}
