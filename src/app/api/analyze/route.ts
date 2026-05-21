import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { ExtractedPage } from '@/lib/pdf-native-extractor';
import type { AnnotationRequest } from '@/lib/pdf-annotator';

// Força rota dinâmica — nunca pré-renderizada
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

  // Imports lazy — carregados apenas em runtime, nunca durante análise estática do build.
  // @react-pdf/renderer e pdfjs-dist criam renderers React customizados ao ser importados;
  // fazê-lo no nível de módulo corromperia o estado interno do React durante o prerender.
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

    logger.info({ filename: file.name, sizeKb: Math.round(pdfBuffer.length / 1024) }, 'analyze_start');

    const extracted = await extractPdfHybrid(pdfBuffer);
    const analysis = await analyzeWithClaude(extracted.consolidatedText);

    const allItems = [
      ...analysis.regularidade_fiscal_trabalhista,
      ...analysis.instrucao_processual,
    ];
    const annotations = buildAnnotations(allItems, extracted.pages, findCitationPage);
    const [annotatedPdf, reportPdf] = await Promise.all([
      annotatePdf(pdfBuffer, annotations),
      generateConformityReport(analysis),
    ]);

    logger.info({ filename: file.name, decisao: analysis.conclusao.decisao_geral }, 'analyze_done');

    results.push({
      filename: file.name,
      analysis,
      reportPdf: reportPdf.toString('base64'),
      annotatedPdf: annotatedPdf.toString('base64'),
    });
  }

  return NextResponse.json({ results });
}
