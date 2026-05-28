import { z } from 'zod';
import { AnalysisResultSchema, type AnalysisResult, type SegmentoId, type Modalidade } from '@/lib/types';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompt';
import { logger } from '@/lib/logger';

function formatZodError(err: z.ZodError): string {
  const lines = err.issues.map((issue) => {
    const path = issue.path.join(' → ') || 'raiz';
    return `• ${path}: ${issue.message}`;
  });
  return `A IA devolveu uma resposta com campos inválidos:\n${lines.join('\n')}\n\nTente novamente ou entre em contato com o suporte se o erro persistir.`;
}

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 16000;
const RETRY_DELAYS_MS = [1000, 3000, 9000];

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

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY não configurada');
  return key;
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    signal: AbortSignal.timeout(240_000),
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: [TOOL_DEFINITION],
      tool_choice: { type: 'tool', name: 'submit_analysis' },
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude API ${response.status}: ${body}`);
  }

  const data = await response.json();

  if (data.stop_reason === 'max_tokens') {
    logger.error({ stop_reason: 'max_tokens', usage: data.usage }, 'claude_response_truncated');
    throw new Error('A resposta do Claude foi cortada por exceder o limite de tokens. Tente um documento menor ou divida o processo em partes.');
  }

  const toolUse = data.content?.find(
    (block: { type: string }) => block.type === 'tool_use',
  ) as { type: string; name: string; input: unknown } | undefined;

  if (!toolUse) {
    logger.error({ stop_reason: data.stop_reason, content_types: data.content?.map((b: { type: string }) => b.type) }, 'claude_no_tool_use');
    throw new Error('Resposta do Claude não contém tool_use.');
  }

  logger.info({ stop_reason: data.stop_reason, usage: data.usage }, 'claude_tool_use_received');
  return toolUse.input;
}

export async function analyzeWithClaude(
  extractedText: string,
  segmento: SegmentoId,
  modalidade: Modalidade,
): Promise<AnalysisResult> {
  const systemPrompt = buildSystemPrompt(segmento, modalidade);
  const userPrompt = buildUserPrompt(extractedText, segmento, modalidade);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      logger.info({ attempt, segmento, modalidade }, 'claude_analyze_attempt');
      const raw = await callClaude(systemPrompt, userPrompt);
      let parsed: AnalysisResult;
      try {
        parsed = AnalysisResultSchema.parse(raw);
      } catch (zodErr) {
        if (zodErr instanceof z.ZodError) {
          logger.error({ issues: zodErr.issues }, 'claude_zod_validation_error');
          throw new Error(formatZodError(zodErr));
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
        lastError.message.includes('overloaded');
      if (!isRetryable || attempt >= RETRY_DELAYS_MS.length) break;
      logger.warn({ attempt, delay: RETRY_DELAYS_MS[attempt] }, 'claude_analyze_retry');
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }

  throw lastError ?? new Error('Falha desconhecida na análise Claude');
}
