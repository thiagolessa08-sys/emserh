import { logger } from '@/lib/logger';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';

export function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY não configurada');
  return key;
}

export interface ClaudeToolCall {
  model: string;
  system: string;
  user: string;
  // Definição da tool no formato da API Anthropic (input_schema etc.)
  tool: { name: string; description: string; input_schema: Record<string, unknown> };
  maxTokens: number;
  timeoutMs?: number;
}

/**
 * Faz UMA chamada à API Anthropic forçando o uso da tool informada e
 * devolve o `input` do bloco tool_use. Lança em erro HTTP, em max_tokens
 * ou quando não há tool_use na resposta.
 */
export async function callClaudeTool(params: ClaudeToolCall): Promise<unknown> {
  const { model, system, user, tool, maxTokens, timeoutMs = 240_000 } = params;

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude API ${response.status}: ${body}`);
  }

  const data = await response.json();

  if (data.stop_reason === 'max_tokens') {
    logger.error({ model, stop_reason: 'max_tokens', usage: data.usage }, 'claude_response_truncated');
    throw new Error('A resposta do Claude foi cortada por exceder o limite de tokens.');
  }

  const toolUse = data.content?.find(
    (block: { type: string }) => block.type === 'tool_use',
  ) as { type: string; name: string; input: unknown } | undefined;

  if (!toolUse) {
    logger.error(
      { model, stop_reason: data.stop_reason, content_types: data.content?.map((b: { type: string }) => b.type) },
      'claude_no_tool_use',
    );
    throw new Error('Resposta do Claude não contém tool_use.');
  }

  logger.info({ model, stop_reason: data.stop_reason, usage: data.usage }, 'claude_tool_use_received');
  return toolUse.input;
}
