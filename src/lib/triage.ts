import type { ExtractedPage } from '@/lib/pdf-native-extractor';
import { callClaudeTool } from '@/lib/claude-client';
import { getSegmentChecklist, getSegmentLabel } from '@/lib/segment-rules';
import type { SegmentoId, Modalidade } from '@/lib/types';
import { logger } from '@/lib/logger';

export interface TriageChunkResult {
  documentos_encontrados: Array<{ pagina: number; tipo_documento: string }>;
}

export interface TriageResult {
  relevantPages: number[];
  pageTypes: Record<number, string>;
}

/** Divide as páginas em blocos sequenciais de no máximo `size` páginas. */
export function chunkPages(pages: ExtractedPage[], size: number): ExtractedPage[][] {
  const chunks: ExtractedPage[][] = [];
  for (let i = 0; i < pages.length; i += size) {
    chunks.push(pages.slice(i, i + size));
  }
  return chunks;
}

/** Une os resultados dos blocos: deduplica páginas válidas e ordena. */
export function aggregateTriage(results: TriageChunkResult[]): TriageResult {
  const pageTypes: Record<number, string> = {};
  const set = new Set<number>();
  for (const r of results) {
    for (const doc of r.documentos_encontrados ?? []) {
      if (Number.isInteger(doc.pagina) && doc.pagina > 0) {
        set.add(doc.pagina);
        if (!pageTypes[doc.pagina]) pageTypes[doc.pagina] = doc.tipo_documento;
      }
    }
  }
  return { relevantPages: [...set].sort((a, b) => a - b), pageTypes };
}

const TRIAGE_MODEL = 'claude-haiku-4-5';
const CHUNK_SIZE = 40;
const CONCURRENCY = 4;
const TRIAGE_MAX_TOKENS = 4000;

const TRIAGE_TOOL = {
  name: 'submit_triagem',
  description: 'Lista as páginas do bloco que contêm documentos relevantes para a auditoria de pagamento.',
  input_schema: {
    type: 'object',
    properties: {
      documentos_encontrados: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            pagina: { type: 'integer' },
            tipo_documento: { type: 'string' },
          },
          required: ['pagina', 'tipo_documento'],
        },
      },
    },
    required: ['documentos_encontrados'],
  },
};

/** Executa `fn` sobre `items` com no máximo `limit` chamadas concorrentes. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function buildTriageSystemPrompt(segmento: SegmentoId, modalidade: Modalidade): string {
  const checklist = getSegmentChecklist(segmento, modalidade);
  const tipos = [...checklist.regularidade, ...checklist.instrucao]
    .map((it) => `- ${it.descricao}`)
    .join('\n');

  return `Você é um pré-triador de documentos da GCIF/EMSERH. Sua tarefa é APENAS localizar em quais páginas aparecem documentos relevantes para a auditoria de um processo de pagamento do segmento "${getSegmentLabel(segmento)}".

NÃO julgue conformidade. Apenas identifique a página e o tipo do documento.

TIPOS DE DOCUMENTO RELEVANTES PARA ESTE SEGMENTO:
${tipos}

TAMBÉM SÃO RELEVANTES (sempre inclua quando aparecerem):
- Página de capa / identificação do processo (credor, CNPJ, nº do contrato, processo SEI, valor)
- Contrato, termos aditivos e extratos de publicação
- Notas fiscais, faturas, certidões, guias de recolhimento, ordens de serviço/fornecimento

REGRAS:
- Na dúvida, INCLUA a página (priorize cobertura, não precisão).
- Liste cada página relevante uma única vez com o tipo de documento predominante nela.
- Páginas em branco, de separação ou claramente irrelevantes não devem ser listadas.
- Responda SOMENTE via tool call "submit_triagem".`;
}

function buildTriageUserPrompt(chunk: ExtractedPage[]): string {
  const body = chunk
    .map((p) => `=== PÁGINA ${p.pageNumber} ===\n${p.text}`)
    .join('\n\n');
  return `Analise as páginas abaixo e liste as relevantes via tool call.\n\n${body}`;
}

/**
 * Fase 1 — triagem. Divide as páginas em blocos, classifica cada bloco com
 * Haiku em paralelo e agrega as páginas relevantes. Blocos que falharem são
 * ignorados (não derrubam a triagem inteira).
 */
export async function triagePages(
  pages: ExtractedPage[],
  segmento: SegmentoId,
  modalidade: Modalidade,
  onProgress?: (done: number, total: number) => void,
): Promise<TriageResult> {
  const chunks = chunkPages(pages, CHUNK_SIZE);
  const system = buildTriageSystemPrompt(segmento, modalidade);
  let done = 0;

  const chunkResults = await mapWithConcurrency(chunks, CONCURRENCY, async (chunk) => {
    try {
      const raw = await callClaudeTool({
        model: TRIAGE_MODEL,
        system,
        user: buildTriageUserPrompt(chunk),
        tool: TRIAGE_TOOL,
        maxTokens: TRIAGE_MAX_TOKENS,
        timeoutMs: 120_000,
      });
      return raw as TriageChunkResult;
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), firstPage: chunk[0]?.pageNumber },
        'triage_chunk_failed',
      );
      return { documentos_encontrados: [] } as TriageChunkResult;
    } finally {
      done++;
      onProgress?.(done, chunks.length);
    }
  });

  const aggregated = aggregateTriage(chunkResults);
  logger.info(
    { totalPages: pages.length, chunks: chunks.length, relevantes: aggregated.relevantPages.length },
    'triage_done',
  );
  return aggregated;
}
