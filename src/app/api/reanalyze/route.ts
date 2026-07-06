import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runAnalysisOnText } from '@/lib/claude-analyzer';
import type { SegmentoId, Modalidade } from '@/lib/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  focusedText: z.string().min(1),
  segmento: z.enum(['fornecedor', 'cessao_mao_obra', 'engenharia', 'servicos_medicos', 'locacao_pf', 'locacao_pj', 'monopolio']),
  modalidade: z.enum(['contrato', 'indenizatorio']),
  regraExtra: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
  try {
    const analysis = await runAnalysisOnText(
      parsed.data.focusedText,
      parsed.data.segmento as SegmentoId,
      parsed.data.modalidade as Modalidade,
      parsed.data.regraExtra,
    );
    return NextResponse.json({ analysis });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'reanalyze_failed');
    return NextResponse.json({ error: 'Falha ao reanalisar' }, { status: 500 });
  }
}
