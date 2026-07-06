import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AnalysisResultSchema } from '@/lib/types';
import { generateConformityReport } from '@/lib/report-generator';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const DispensaSchema = z.object({
  secao: z.enum(['reg', 'inst']),
  item: z.number().int(),
  justificativa: z.string().min(1),
  auditorNome: z.string(),
  dataISO: z.string(),
});

const BodySchema = z.object({
  analysis: AnalysisResultSchema,
  dispensas: z.array(DispensaSchema),
  regraExtra: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
  try {
    const pdf = await generateConformityReport(parsed.data.analysis, parsed.data.dispensas, parsed.data.regraExtra);
    return NextResponse.json({ reportPdf: pdf.toString('base64') });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'report_regen_failed');
    return NextResponse.json({ error: 'Falha ao gerar o relatório' }, { status: 500 });
  }
}
