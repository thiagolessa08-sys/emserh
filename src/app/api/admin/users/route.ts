import { NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/admin-guard';
import { listUsers, createUser, deleteUser, setPassword, CreateUserSchema, ResetPasswordSchema } from '@/lib/users-store';
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
    await createUser(parsed.data);
  } catch (err) {
    if (err instanceof Error && err.message === 'DUPLICATE') {
      return NextResponse.json({ error: 'Já existe um usuário com esse e-mail' }, { status: 409 });
    }
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'user_create_failed');
    return NextResponse.json({ error: 'Falha ao criar usuário' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  if (!(await isAdminAuthed('usuarios'))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = ResetPasswordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.issues }, { status: 400 });
  try {
    await setPassword(parsed.data.email, parsed.data.senha);
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'user_reset_failed');
    return NextResponse.json({ error: 'Falha ao redefinir senha' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthed('usuarios'))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'email ausente' }, { status: 400 });
  await deleteUser(email);
  return NextResponse.json({ ok: true });
}
