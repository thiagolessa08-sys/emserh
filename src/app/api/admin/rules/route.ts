import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthToken } from '@/lib/admin-auth';
import { getRulesStore, saveCombination, CombinationPayloadSchema } from '@/lib/rules-store';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function isAuthed(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyAuthToken(cookieStore.get('admin_auth')?.value);
}

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const store = await getRulesStore();
  return NextResponse.json({ store });
}

export async function POST(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const parsed = CombinationPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.issues }, { status: 400 });
  }
  try {
    await saveCombination(parsed.data.segmento, parsed.data.modalidade, parsed.data.checklist);
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'rules_save_failed');
    return NextResponse.json({ error: 'Falha ao salvar as regras' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
