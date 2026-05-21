import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { ExtractedPage } from '@/lib/pdf-native-extractor';
import type { AnnotationRequest } from '@/lib/pdf-annotator';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

function statusToColor(status: string): 'green' | 'red' | 'yellow' {
  if (status === 'CONFORME') return 'green';
  if (status === 'NAO_CONFORME') return 'red';
  return 'yellow';
}

function buildAnnotations(
  allItems: Array<{ status: string; descricao: string; citacao: string; pagina_estimada: number }>,
  pages: ExtractedPage[],
  findCitationPage: (citation: string, pages: Array<{ pageNumber: number; text: string }>) => number,
): AnnotationRequest[] {
  return allItems.map((item) => {
    const pageIndex = pages.map((p) => ({ pageNumber: p.pageNumber, text: p.text }));
    const pageNumber = findCitationPage(item.citacao, pageIndex) ?? item.pagina_estimada;
    return {
      pageNumber,
      color: statusToColor(item.status),
      label: `[${item.status}] ${item.descricao.slice(0, 60)}`,
    };
  });
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Requisição inválida: esperado multipart/form-data' }, { status: 400 });
  }

  const entries = formData.getAll('files') as File[];
  if (!entries || entries.length === 0) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado. Use o campo "files".' }, { status: 400 });
  }

  for (const file of entries) {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: `Arquivo "${file.name}" não é um PDF. Apenas arquivos PDF são aceitos.` },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Arquivo "${file.name}" excede o limite de 50 MB.` },
        { status: 400 },
      );
    }
  }

  const encoder = new TextEncoder();
  const globalStart = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      function progress(stage: string, message: string) {
        const elapsedS = Math.round((Date.now() - globalStart) / 1000);
        send({ type: 'progress', stage, message });
        logger.info({ stage, message, elapsedS }, 'progress_event');
      }

      try {
        const [
          { extractPdfHybrid },
          { analyzeWithClaude },
          { generateConformityReport },
          { annotatePdf },
          { findCitationPage },
        ] = await Promise.all([
          import('@/lib/pdf-extractor'),
          import('@/lib/claude-analyzer'),
          import('@/lib/report-generator'),
          import('@/lib/pdf-annotator'),
          import('@/lib/citation-matcher'),
        ]);

        const results = [];

        for (const file of entries) {
          const arrayBuffer = await file.arrayBuffer();
          const pdfBuffer = Buffer.from(arrayBuffer);

          logger.info(
            { filename: file.name, sizeKb: Math.round(pdfBuffer.length / 1024) },
            'analyze_start',
          );

          // Etapas 1+2 — Extração de texto e OCR com progresso em tempo real
          const t0 = Date.now();
          const label = entries.length > 1 ? ` (${file.name})` : '';
          progress('extracting', `Extraindo texto do PDF${label}...`);

          const extracted = await extractPdfHybrid(pdfBuffer, (stage, message) => {
            progress(stage, message);
          });
          const extractMs = Date.now() - t0;

          logger.info(
            {
              filename: file.name,
              totalPages: extracted.totalPages,
              scannedPages: extracted.scannedPageCount,
              textChars: extracted.consolidatedText.length,
              ms: extractMs,
            },
            'step_extract_done',
          );

          // Etapa 3 — Análise com Claude
          const t1 = Date.now();
          progress(
            'analyzing',
            `Analisando ${extracted.totalPages} página(s) com IA... (pode levar até 3 min)`,
          );

          // Keepalive: envia ping SSE a cada 20s para evitar timeout do proxy
          const keepalive = setInterval(() => {
            try { controller.enqueue(encoder.encode(': ping\n\n')); } catch { /* stream fechado */ }
          }, 20_000);

          let analysis: Awaited<ReturnType<typeof analyzeWithClaude>>;
          try {
            analysis = await analyzeWithClaude(extracted.consolidatedText);
          } finally {
            clearInterval(keepalive);
          }
          const analyzeMs = Date.now() - t1;

          logger.info(
            {
              filename: file.name,
              decisao: analysis.conclusao.decisao_geral,
              conformes: analysis.conclusao.total_itens_conformes,
              naoConformes: analysis.conclusao.total_itens_nao_conformes,
              atencao: analysis.conclusao.total_itens_atencao,
              ms: analyzeMs,
            },
            'step_analyze_done',
          );

          // Etapa 4 — Geração do relatório e anotações
          const t2 = Date.now();
          progress('generating', 'Gerando Relatório de Conformidade e anotações no PDF...');

          const allItems = [
            ...analysis.regularidade_fiscal_trabalhista,
            ...analysis.instrucao_processual,
          ];
          const annotations = buildAnnotations(allItems, extracted.pages, findCitationPage);

          const [annotatedPdf, reportPdf] = await Promise.all([
            annotatePdf(pdfBuffer, annotations),
            generateConformityReport(analysis),
          ]);
          const generateMs = Date.now() - t2;

          logger.info(
            { filename: file.name, annotations: annotations.length, ms: generateMs },
            'step_generate_done',
          );

          results.push({
            filename: file.name,
            analysis,
            reportPdf: reportPdf.toString('base64'),
            annotatedPdf: annotatedPdf.toString('base64'),
          });
        }

        const totalMs = Date.now() - globalStart;
        logger.info({ files: entries.length, totalMs }, 'analyze_all_done');

        send({ type: 'result', results });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        const elapsedMs = Date.now() - globalStart;

        logger.error({ message, stack, elapsedMs }, 'analyze_error');

        send({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
