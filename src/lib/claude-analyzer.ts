import { z } from 'zod';
import { AnalysisResultSchema, type AnalysisResult, type SegmentoId, type Modalidade } from '@/lib/types';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompt';
import { logger } from '@/lib/logger';
import type { ExtractedPage } from '@/lib/pdf-native-extractor';
import { callClaudeTool } from '@/lib/claude-client';
import { triagePages } from '@/lib/triage';
import { getRulesStore } from '@/lib/rules-store';
import { getSegmentChecklist } from '@/lib/segment-rules';

const COVER_PAGES = [1, 2, 3];

// Limite por página: evita que documentos longos (Atas, Estatutos)
// monopolizem o orçamento de caracteres e excluam certidões curtas.
// Certidões/CND/CRF cabem facilmente em 4 000 chars; Atas têm muitas páginas
// então o limite por página é suficiente para capturar o conteúdo relevante.
const MAX_CHARS_PER_PAGE = 4_000;

/**
 * Monta o texto focado para a análise: páginas de capa (1-3) + páginas
 * marcadas pela triagem. Se a triagem não retornou nada, usa todas as
 * páginas.
 *
 * Cada página é truncada em MAX_CHARS_PER_PAGE para evitar que documentos
 * muito longos (Atas, Estatutos, 60+ páginas) consumam todo o orçamento e
 * excluam certidões curtas que aparecem mais adiante no processo.
 * O total é limitado a maxChars.
 */
export function selectRelevantPages(
  pages: ExtractedPage[],
  relevantPageNumbers: number[],
  maxChars: number,
): string {
  let source: ExtractedPage[];
  if (relevantPageNumbers.length === 0) {
    source = pages; // fallback: todo o documento
  } else {
    const wanted = new Set<number>([...COVER_PAGES, ...relevantPageNumbers]);
    source = pages.filter((p) => wanted.has(p.pageNumber));
  }

  const parts: string[] = [];
  let total = 0;

  for (const p of source.slice().sort((a, b) => a.pageNumber - b.pageNumber)) {
    const pageText = p.text.length > MAX_CHARS_PER_PAGE
      ? p.text.slice(0, MAX_CHARS_PER_PAGE) + '\n[... página truncada ...]'
      : p.text;
    const block = `=== PÁGINA ${p.pageNumber} ===\n${pageText}`;
    if (total + block.length > maxChars) break;
    parts.push(block);
    total += block.length + 2; // +2 pelo '\n\n' separador
  }

  return parts.join('\n\n');
}

function formatZodError(err: z.ZodError): string {
  const lines = err.issues.map((issue) => {
    const path = issue.path.join(' → ') || 'raiz';
    return `• ${path}: ${issue.message}`;
  });
  return `A IA devolveu uma resposta com campos inválidos:\n${lines.join('\n')}\n\nTente novamente ou entre em contato com o suporte se o erro persistir.`;
}

// Configura o modelo de análise via env var; fallback para Sonnet estável.
// Para trocar sem redeploy de código: defina ANTHROPIC_ANALYSIS_MODEL no Railway.
const ANALYSIS_MODEL =
  process.env.ANTHROPIC_ANALYSIS_MODEL ?? 'claude-sonnet-4-6';
const MAX_TOKENS = 16000;
const RETRY_DELAYS_MS = [1000, 3000, 9000];
const MAX_FOCUSED_CHARS = 300_000;

const CHECKLIST_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    item: { type: 'integer' },
    descricao: { type: 'string' },
    status: { type: 'string', enum: ['CONFORME', 'NAO_CONFORME', 'ATENCAO'] },
    motivo: { type: ['string', 'null'] },
    documento_verificador: { type: ['string', 'null'] },
    citacao: { type: 'string' },
    pagina_estimada: { type: 'integer' },
    observacoes: { type: 'string' },
    sugestao_correcao: { type: ['string', 'null'] },
  },
  required: ['item', 'descricao', 'status', 'motivo', 'documento_verificador', 'citacao', 'pagina_estimada', 'observacoes', 'sugestao_correcao'],
};

const TOOL_DEFINITION = {
  name: 'submit_analysis',
  description: 'Submete o resultado estruturado da análise de conformidade do processo de pagamento.',
  input_schema: {
    type: 'object',
    properties: {
      identificacao_contrato: {
        type: 'object',
        properties: {
          credor: { type: 'string' },
          cnpj: { type: 'string' },
          contrato_numero: { type: 'string' },
          objeto: { type: 'string' },
          periodo_referencia: { type: 'string' },
          processo_sei: { type: 'string' },
          valor_total: { type: 'string' },
        },
        required: ['credor', 'cnpj', 'contrato_numero', 'objeto', 'periodo_referencia', 'processo_sei', 'valor_total'],
      },
      regularidade_fiscal_trabalhista: {
        type: 'array',
        minItems: 1,
        items: {
          ...CHECKLIST_ITEM_SCHEMA,
          properties: {
            ...CHECKLIST_ITEM_SCHEMA.properties,
            data_validade: { type: ['string', 'null'] },
          },
          required: [...CHECKLIST_ITEM_SCHEMA.required, 'data_validade'],
        },
      },
      instrucao_processual: {
        type: 'array',
        minItems: 1,
        items: CHECKLIST_ITEM_SCHEMA,
      },
      conclusao: {
        type: 'object',
        properties: {
          decisao_geral: { type: 'string', enum: ['CONFORME', 'NAO_CONFORME', 'PENDENTE_AJUSTES'] },
          resumo: { type: 'string' },
          total_itens_conformes: { type: 'integer' },
          total_itens_nao_conformes: { type: 'integer' },
          total_itens_atencao: { type: 'integer' },
          lista_pendencias: { type: 'array', items: { type: 'string' } },
        },
        required: ['decisao_geral', 'resumo', 'total_itens_conformes', 'total_itens_nao_conformes', 'total_itens_atencao', 'lista_pendencias'],
      },
    },
    required: ['identificacao_contrato', 'regularidade_fiscal_trabalhista', 'instrucao_processual', 'conclusao'],
  },
};

export async function runAnalysisOnText(
  focusedText: string,
  segmento: SegmentoId,
  modalidade: Modalidade,
): Promise<AnalysisResult> {
  const store = await getRulesStore();
  const checklist = getSegmentChecklist(store, segmento, modalidade);
  const systemPrompt = buildSystemPrompt(checklist, segmento, modalidade);
  const userPrompt = buildUserPrompt(focusedText, checklist);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      logger.info({ attempt, segmento, modalidade }, 'claude_analyze_attempt');
      const raw = await callClaudeTool({
        model: ANALYSIS_MODEL,
        system: systemPrompt,
        user: userPrompt,
        tool: TOOL_DEFINITION,
        maxTokens: MAX_TOKENS,
      });

      let parsed: AnalysisResult;
      try {
        parsed = AnalysisResultSchema.parse(raw);
      } catch (zodErr) {
        if (zodErr instanceof z.ZodError) {
          logger.error({ issues: zodErr.issues, attempt }, 'claude_zod_validation_error');
          // Erros de schema são retentáveis — Claude às vezes devolve tipo errado
          throw new Error(`__ZOD__${formatZodError(zodErr)}`);
        }
        throw zodErr;
      }
      logger.info({ decisao: parsed.conclusao.decisao_geral }, 'claude_analyze_done');
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRetryable =
        lastError.message.includes('529') ||
        lastError.message.includes('503') ||
        lastError.message.includes('overloaded') ||
        lastError.message.startsWith('__ZOD__'); // schema inválido → retry
      if (!isRetryable || attempt >= RETRY_DELAYS_MS.length) break;
      logger.warn({ attempt, delay: RETRY_DELAYS_MS[attempt] }, 'claude_analyze_retry');
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }

  // Remove prefixo interno antes de expor ao usuário
  if (lastError?.message.startsWith('__ZOD__')) {
    throw new Error(lastError.message.slice('__ZOD__'.length));
  }
  throw lastError ?? new Error('Falha desconhecida na análise Claude');
}

export interface AnalyzeProgress {
  triageChunk?: (done: number, total: number) => void;
  onMessage?: (message: string) => void;
}

/**
 * Pipeline completo: triagem (Haiku, paralelo) → seleção de páginas →
 * análise (Sonnet). Se a triagem falhar, faz fallback para analisar todo
 * o documento truncado, garantindo que o app nunca quebre.
 */
export async function analyzeProcess(
  pages: ExtractedPage[],
  segmento: SegmentoId,
  modalidade: Modalidade,
  progress?: AnalyzeProgress,
): Promise<AnalysisResult> {
  let relevantPages: number[] = [];
  try {
    progress?.onMessage?.('Triagem: localizando documentos nas páginas...');
    const triage = await triagePages(pages, segmento, modalidade, (done, total) => {
      progress?.triageChunk?.(done, total);
    });
    relevantPages = triage.relevantPages;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'triage_failed_fallback',
    );
    relevantPages = []; // fallback dentro de selectRelevantPages
  }

  const focusedText = selectRelevantPages(pages, relevantPages, MAX_FOCUSED_CHARS);
  const qtd = relevantPages.length > 0 ? `${relevantPages.length} página(s) relevante(s)` : 'todo o documento';
  progress?.onMessage?.(`Analisando ${qtd} com IA...`);

  return runAnalysisOnText(focusedText, segmento, modalidade);
}
