import { AnalysisResultSchema, type AnalysisResult } from '@/lib/types';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompt';
import { logger } from '@/lib/logger';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;
const RETRY_DELAYS_MS = [1000, 3000, 9000];

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
        minItems: 7,
        maxItems: 7,
        items: {
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
            data_validade: { type: ['string', 'null'] },
          },
          required: ['item', 'descricao', 'status', 'motivo', 'documento_verificador', 'citacao', 'pagina_estimada', 'observacoes', 'sugestao_correcao', 'data_validade'],
        },
      },
      instrucao_processual: {
        type: 'array',
        minItems: 8,
        maxItems: 8,
        items: {
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
        },
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

async function callClaude(userPrompt: string): Promise<unknown> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    signal: AbortSignal.timeout(240_000), // 4 minutos máximo
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(),
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
  const toolUse = data.content?.find(
    (block: { type: string }) => block.type === 'tool_use',
  ) as { type: string; name: string; input: unknown } | undefined;

  if (!toolUse) {
    throw new Error('Resposta do Claude não contém tool_use. Verifique o prompt e tool_choice.');
  }

  return toolUse.input;
}

export async function analyzeWithClaude(extractedText: string): Promise<AnalysisResult> {
  const userPrompt = buildUserPrompt(extractedText);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      logger.info({ attempt }, 'claude_analyze_attempt');
      const raw = await callClaude(userPrompt);
      const parsed = AnalysisResultSchema.parse(raw);
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
