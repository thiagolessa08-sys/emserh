# Triagem + Análise (Map-Reduce para processos longos) — Plano de Implementação

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: Use superpowers:executing-plans para implementar este plano tarefa por tarefa. Os passos usam sintaxe de checkbox (`- [ ]`) para rastreamento.

**Objetivo:** Substituir a única chamada ao Claude (que truncava em 150k chars e travava em PDFs longos) por um pipeline de duas fases: triagem barata (Haiku, em paralelo) localiza as páginas relevantes, e a análise (Sonnet) julga a conformidade lendo apenas essas páginas.

**Arquitetura:** Um cliente HTTP compartilhado (`claude-client.ts`) faz chamadas à API Anthropic com tool use. A triagem (`triage.ts`) divide as páginas em blocos de 40, classifica cada bloco com Haiku em paralelo e agrega as páginas relevantes. O orquestrador em `claude-analyzer.ts` monta um texto focado (páginas de capa + páginas relevantes, com limite de segurança) e roda a análise final. Se a triagem falhar, faz fallback para o comportamento antigo (todas as páginas truncadas), garantindo que o app nunca quebre.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod v4, Vitest, Claude tool use (Haiku para triagem, Sonnet para análise).

---

## Arquivos afetados

- Criar: `src/lib/claude-client.ts`
- Criar: `src/lib/triage.ts`
- Criar: `tests/unit/triage.test.ts`
- Criar: `tests/unit/select-relevant-pages.test.ts`
- Modificar: `src/lib/claude-analyzer.ts`
- Modificar: `src/app/api/analyze/route.ts`
- Modificar: `src/components/ProgressIndicator.tsx`
- Modificar: `src/app/page.tsx`

---

## Tarefa 1: Cliente HTTP compartilhado (`claude-client.ts`)

**Arquivos:**
- Criar: `src/lib/claude-client.ts`

- [ ] **Passo 1: Criar o cliente de baixo nível**

Este módulo concentra a chamada HTTP à API Anthropic com `tool_choice` forçado. Sem retry aqui (o retry fica nos chamadores). Extrai e devolve `tool_use.input`.

```typescript
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
```

- [ ] **Passo 2: Verificar build**

Run: `npm run build`
Expected: build passa sem erros (o módulo ainda não é importado por ninguém, mas precisa compilar).

- [ ] **Passo 3: Commit**

```bash
git add src/lib/claude-client.ts
git commit -m "feat: cliente HTTP compartilhado da API Anthropic (callClaudeTool)"
```

---

## Tarefa 2: Funções puras de triagem + testes (`triage.ts` parte 1)

**Arquivos:**
- Criar: `src/lib/triage.ts`
- Criar: `tests/unit/triage.test.ts`

- [ ] **Passo 1: Escrever os testes falhando**

Arquivo `tests/unit/triage.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { chunkPages, aggregateTriage } from '@/lib/triage';
import type { ExtractedPage } from '@/lib/pdf-native-extractor';

function makePage(pageNumber: number): ExtractedPage {
  return { pageNumber, text: `texto ${pageNumber}`, isScanned: false, textItems: [] };
}

describe('chunkPages', () => {
  it('divide 100 páginas em blocos de 40', () => {
    const pages = Array.from({ length: 100 }, (_, i) => makePage(i + 1));
    const chunks = chunkPages(pages, 40);
    expect(chunks.map((c) => c.length)).toEqual([40, 40, 20]);
  });

  it('mantém tudo em um bloco quando menor que o tamanho', () => {
    const pages = Array.from({ length: 10 }, (_, i) => makePage(i + 1));
    const chunks = chunkPages(pages, 40);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(10);
  });

  it('preserva os números de página originais', () => {
    const pages = Array.from({ length: 50 }, (_, i) => makePage(i + 1));
    const chunks = chunkPages(pages, 40);
    expect(chunks[1][0].pageNumber).toBe(41);
  });
});

describe('aggregateTriage', () => {
  it('une e deduplica páginas de múltiplos blocos, ordenadas', () => {
    const result = aggregateTriage([
      { documentos_encontrados: [{ pagina: 5, tipo_documento: 'CND' }, { pagina: 2, tipo_documento: 'NF' }] },
      { documentos_encontrados: [{ pagina: 5, tipo_documento: 'CND' }, { pagina: 9, tipo_documento: 'Contrato' }] },
    ]);
    expect(result.relevantPages).toEqual([2, 5, 9]);
  });

  it('ignora páginas inválidas (<= 0 ou não inteiras)', () => {
    const result = aggregateTriage([
      { documentos_encontrados: [{ pagina: 0, tipo_documento: 'x' }, { pagina: -1, tipo_documento: 'y' }, { pagina: 3, tipo_documento: 'z' }] },
    ]);
    expect(result.relevantPages).toEqual([3]);
  });

  it('retorna lista vazia quando não há documentos', () => {
    const result = aggregateTriage([{ documentos_encontrados: [] }]);
    expect(result.relevantPages).toEqual([]);
  });
});
```

- [ ] **Passo 2: Rodar os testes para confirmar que falham**

Run: `npm run test -- triage`
Expected: FAIL com erro de import (`chunkPages`/`aggregateTriage` não existem).

- [ ] **Passo 3: Implementar as funções puras**

Criar `src/lib/triage.ts` com (apenas as funções puras e tipos por enquanto):

```typescript
import type { ExtractedPage } from '@/lib/pdf-native-extractor';

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
```

- [ ] **Passo 4: Rodar os testes para confirmar que passam**

Run: `npm run test -- triage`
Expected: PASS (6 testes).

- [ ] **Passo 5: Commit**

```bash
git add src/lib/triage.ts tests/unit/triage.test.ts
git commit -m "feat: funções puras de triagem (chunkPages, aggregateTriage) + testes"
```

---

## Tarefa 3: Triagem com Haiku em paralelo (`triage.ts` parte 2)

**Arquivos:**
- Modificar: `src/lib/triage.ts`

- [ ] **Passo 1: Adicionar a tool de triagem, o concorrência limitada e a função `triagePages`**

Acrescentar ao final de `src/lib/triage.ts`:

```typescript
import { callClaudeTool } from '@/lib/claude-client';
import { getSegmentChecklist, getSegmentLabel } from '@/lib/segment-rules';
import type { SegmentoId, Modalidade } from '@/lib/types';
import { logger } from '@/lib/logger';

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
```

- [ ] **Passo 2: Verificar build**

Run: `npm run build`
Expected: build passa. Os testes da Tarefa 2 continuam verdes (as funções puras não mudaram).

- [ ] **Passo 3: Rodar os testes**

Run: `npm run test -- triage`
Expected: PASS (6 testes — as funções puras seguem funcionando).

- [ ] **Passo 4: Commit**

```bash
git add src/lib/triage.ts
git commit -m "feat: triagem com Haiku em paralelo (triagePages)"
```

---

## Tarefa 4: Seleção de páginas relevantes + testes (`claude-analyzer.ts` parte 1)

**Arquivos:**
- Modificar: `src/lib/claude-analyzer.ts`
- Criar: `tests/unit/select-relevant-pages.test.ts`

- [ ] **Passo 1: Escrever os testes falhando**

Arquivo `tests/unit/select-relevant-pages.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { selectRelevantPages } from '@/lib/claude-analyzer';
import type { ExtractedPage } from '@/lib/pdf-native-extractor';

function makePage(pageNumber: number, text = `texto da pagina ${pageNumber}`): ExtractedPage {
  return { pageNumber, text, isScanned: false, textItems: [] };
}

const pages = Array.from({ length: 20 }, (_, i) => makePage(i + 1));

describe('selectRelevantPages', () => {
  it('sempre inclui as páginas de capa (1-3) além das relevantes', () => {
    const text = selectRelevantPages(pages, [10, 15], 1_000_000);
    expect(text).toContain('=== PÁGINA 1 ===');
    expect(text).toContain('=== PÁGINA 2 ===');
    expect(text).toContain('=== PÁGINA 3 ===');
    expect(text).toContain('=== PÁGINA 10 ===');
    expect(text).toContain('=== PÁGINA 15 ===');
    expect(text).not.toContain('=== PÁGINA 11 ===');
  });

  it('mantém a ordem crescente de páginas', () => {
    const text = selectRelevantPages(pages, [15, 10], 1_000_000);
    expect(text.indexOf('PÁGINA 10')).toBeLessThan(text.indexOf('PÁGINA 15'));
  });

  it('faz fallback para todas as páginas quando não há relevantes', () => {
    const text = selectRelevantPages(pages, [], 1_000_000);
    expect(text).toContain('=== PÁGINA 20 ===');
  });

  it('trunca no limite de caracteres', () => {
    const text = selectRelevantPages(pages, [], 50);
    expect(text.length).toBe(50);
  });
});
```

- [ ] **Passo 2: Rodar os testes para confirmar que falham**

Run: `npm run test -- select-relevant-pages`
Expected: FAIL com erro de import (`selectRelevantPages` não existe).

- [ ] **Passo 3: Implementar `selectRelevantPages`**

No topo de `src/lib/claude-analyzer.ts`, logo após os imports existentes, adicionar o import de tipo e a função exportada:

```typescript
import type { ExtractedPage } from '@/lib/pdf-native-extractor';

const COVER_PAGES = [1, 2, 3];

/**
 * Monta o texto focado para a análise: páginas de capa (1-3) + páginas
 * marcadas pela triagem. Se a triagem não retornou nada, usa todas as
 * páginas. Trunca no limite de caracteres por segurança.
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

  const text = source
    .slice()
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((p) => `=== PÁGINA ${p.pageNumber} ===\n${p.text}`)
    .join('\n\n');

  return text.length > maxChars ? text.slice(0, maxChars) : text;
}
```

- [ ] **Passo 4: Rodar os testes para confirmar que passam**

Run: `npm run test -- select-relevant-pages`
Expected: PASS (4 testes).

- [ ] **Passo 5: Commit**

```bash
git add src/lib/claude-analyzer.ts tests/unit/select-relevant-pages.test.ts
git commit -m "feat: selecao de paginas relevantes para analise focada + testes"
```

---

## Tarefa 5: Refatorar a análise para usar o cliente compartilhado e o orquestrador (`claude-analyzer.ts` parte 2)

**Arquivos:**
- Modificar: `src/lib/claude-analyzer.ts`

- [ ] **Passo 1: Trocar o `callClaude` interno pelo `callClaudeTool` compartilhado**

Em `src/lib/claude-analyzer.ts`:

1. Remover as constantes `ENDPOINT`, `getApiKey` e a função `callClaude` (passam a vir de `claude-client.ts`). Manter `MODEL`, `MAX_TOKENS`, `RETRY_DELAYS_MS`, `TOOL_DEFINITION`, `CHECKLIST_ITEM_SCHEMA` e `formatZodError`.

2. Adicionar o import no topo:

```typescript
import { callClaudeTool } from '@/lib/claude-client';
import { triagePages } from '@/lib/triage';
```

3. Renomear `MODEL` para `ANALYSIS_MODEL` (deixa explícito que é o modelo da fase de análise):

```typescript
const ANALYSIS_MODEL = 'claude-sonnet-4-6';
```

- [ ] **Passo 2: Reescrever a função de análise para operar sobre texto focado**

Substituir a função `analyzeWithClaude` atual por `runAnalysisOnText` (mesma lógica de retry, mas usando `callClaudeTool` e recebendo o texto já focado):

```typescript
async function runAnalysisOnText(
  focusedText: string,
  segmento: SegmentoId,
  modalidade: Modalidade,
): Promise<AnalysisResult> {
  const systemPrompt = buildSystemPrompt(segmento, modalidade);
  const userPrompt = buildUserPrompt(focusedText, segmento, modalidade);
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
        lastError.message.startsWith('__ZOD__');
      if (!isRetryable || attempt >= RETRY_DELAYS_MS.length) break;
      logger.warn({ attempt, delay: RETRY_DELAYS_MS[attempt] }, 'claude_analyze_retry');
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }

  if (lastError?.message.startsWith('__ZOD__')) {
    throw new Error(lastError.message.slice('__ZOD__'.length));
  }
  throw lastError ?? new Error('Falha desconhecida na análise Claude');
}
```

- [ ] **Passo 3: Adicionar o orquestrador `analyzeProcess`**

Adicionar (export público que o route vai usar):

```typescript
const MAX_FOCUSED_CHARS = 180_000;

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
```

- [ ] **Passo 4: Verificar build e testes**

Run: `npm run build`
Expected: erro de type — `src/app/api/analyze/route.ts` ainda chama `analyzeWithClaude`, que não existe mais. (Será corrigido na Tarefa 6.)

Run: `npm run test`
Expected: PASS em todos os testes unitários (triage + select-relevant-pages + smoke).

- [ ] **Passo 5: Commit**

```bash
git add src/lib/claude-analyzer.ts
git commit -m "refactor: orquestrador analyzeProcess (triagem + analise) usando cliente compartilhado"
```

---

## Tarefa 6: Estágio de triagem na UI (`ProgressIndicator.tsx` + `page.tsx`)

**Arquivos:**
- Modificar: `src/components/ProgressIndicator.tsx`
- Modificar: `src/app/page.tsx`

- [ ] **Passo 1: Adicionar o estágio `'triaging'` ao tipo**

Em `src/components/ProgressIndicator.tsx`, substituir o tipo por:

```typescript
export type AnalysisStage =
  | 'idle'
  | 'extracting'
  | 'ocr'
  | 'triaging'
  | 'analyzing'
  | 'generating'
  | 'done'
  | 'error';
```

- [ ] **Passo 2: Adicionar o passo ao rastreador**

Em `src/app/page.tsx`, atualizar `ANALYSIS_STEPS` e `STAGE_ORDER`:

```typescript
const ANALYSIS_STEPS: { stage: AnalysisStage; label: string; desc: string }[] = [
  { stage: 'extracting', label: 'Extração de texto', desc: 'Lendo e convertendo páginas do PDF' },
  { stage: 'ocr', label: 'Reconhecimento OCR', desc: 'Processando páginas digitalizadas com OCR' },
  { stage: 'triaging', label: 'Triagem de documentos', desc: 'Localizando as páginas relevantes do processo' },
  { stage: 'analyzing', label: 'Análise de conformidade', desc: 'Verificando os itens do checklist do segmento' },
  { stage: 'generating', label: 'Geração do relatório', desc: 'Criando PDF anotado e relatório de conformidade' },
];

const STAGE_ORDER: AnalysisStage[] = ['extracting', 'ocr', 'triaging', 'analyzing', 'generating'];
```

- [ ] **Passo 3: Verificar build**

Run: `npm run build`
Expected: ainda falha no `route.ts` (Tarefa 7), mas sem novos erros em `page.tsx`/`ProgressIndicator.tsx`.

- [ ] **Passo 4: Commit**

```bash
git add src/components/ProgressIndicator.tsx src/app/page.tsx
git commit -m "feat: estagio de triagem no rastreador de etapas"
```

---

## Tarefa 7: Integrar o pipeline na rota (`route.ts`)

**Arquivos:**
- Modificar: `src/app/api/analyze/route.ts`

- [ ] **Passo 1: Trocar a chamada de análise pelo orquestrador**

Em `src/app/api/analyze/route.ts`:

1. No bloco de imports dinâmicos (`Promise.all([...])`), trocar o import de `claude-analyzer`:

```typescript
// ANTES:
import('@/lib/claude-analyzer'),
// (continua igual — o import dinâmico do módulo não muda)
```

Dentro do destructuring, trocar `{ analyzeWithClaude }` por `{ analyzeProcess }`:

```typescript
const [
  { extractPdfHybrid },
  { analyzeProcess },
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
```

2. Substituir todo o bloco da "Etapa 3" (da linha `// Etapa 3 — Análise com Claude` até o `const analyzeMs = Date.now() - t1;`) por:

```typescript
          // Etapa 3 — Triagem + Análise com Claude
          const t1 = Date.now();
          progress('triaging', 'Triagem: localizando documentos nas páginas...');

          // Keepalive: envia ping SSE a cada 20s para evitar timeout do proxy
          const keepalive = setInterval(() => {
            try { controller.enqueue(encoder.encode(': ping\n\n')); } catch { /* stream fechado */ }
          }, 20_000);

          let analysis: Awaited<ReturnType<typeof analyzeProcess>>;
          try {
            analysis = await analyzeProcess(
              extracted.pages,
              segmento as import('@/lib/types').SegmentoId,
              modalidade as import('@/lib/types').Modalidade,
              {
                triageChunk: (done, total) =>
                  progress('triaging', `Triagem: ${done}/${total} blocos de páginas analisados...`),
                onMessage: (message) => {
                  // Quando a mensagem indica início da análise, muda o estágio
                  const stage = message.startsWith('Analisando') ? 'analyzing' : 'triaging';
                  progress(stage, message);
                },
              },
            );
          } finally {
            clearInterval(keepalive);
          }
          const analyzeMs = Date.now() - t1;
```

3. Remover o bloco de truncamento manual adicionado anteriormente (as linhas que definem `MAX_TEXT_CHARS`, `consolidatedText`, `truncated` e o `progress('analyzing', ...)` correspondente), pois a seleção/truncamento agora acontece dentro de `analyzeProcess`. Confirme que não sobra nenhuma referência a `consolidatedText` na etapa de análise.

- [ ] **Passo 2: Verificar build**

Run: `npm run build`
Expected: PASS — sem erros de tipo.

- [ ] **Passo 3: Rodar todos os testes**

Run: `npm run test`
Expected: PASS em todos.

- [ ] **Passo 4: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: rota usa pipeline de triagem + analise com progresso em tempo real"
```

---

## Tarefa 8: Verificação final + push

**Arquivos:** nenhum (validação)

- [ ] **Passo 1: Build limpo**

Run: `npm run build`
Expected: build completa sem erros TypeScript.

- [ ] **Passo 2: Suíte de testes completa**

Run: `npm run test`
Expected: PASS (smoke + triage + select-relevant-pages).

- [ ] **Passo 3: Push para o Railway**

```bash
git push
```

---

## Auto-revisão (preenchida pelo autor do plano)

**Cobertura do spec:**
- Triagem barata em paralelo (Haiku) → Tarefas 2 e 3 ✅
- Análise focada (Sonnet) lendo só páginas relevantes → Tarefas 4 e 5 ✅
- Nunca truncar cegamente / fallback robusto → `selectRelevantPages` (relevantPages vazio = todas as páginas) + try/catch em `analyzeProcess` ✅
- Feedback em tempo real (resolve o "10 min travado") → estágio `triaging` + progresso por bloco (Tarefas 6 e 7) ✅
- Suporta 150–400 páginas → blocos de 40, concorrência 4, limite de 180k chars na análise ✅

**Consistência de tipos:**
- `ExtractedPage` (de `pdf-native-extractor`) usado em triage.ts, claude-analyzer.ts e nos testes ✅
- `TriageChunkResult` / `TriageResult` definidos na Tarefa 2 e usados na Tarefa 3 ✅
- `callClaudeTool` com a mesma assinatura na Tarefa 1 e usado nas Tarefas 3 e 5 ✅
- `analyzeProcess(pages, segmento, modalidade, progress?)` definido na Tarefa 5 e chamado na Tarefa 7 ✅
- `AnalysisStage` com `'triaging'` na Tarefa 6, usado na Tarefa 7 via `progress('triaging', ...)` ✅

**Risco conhecido (mitigado):** o nome exato do modelo Haiku (`claude-haiku-4-5`) pode precisar de ajuste no ambiente. Se a triagem falhar por modelo inválido, o try/catch em `analyzeProcess` faz fallback para análise do documento inteiro truncado — o app continua funcionando, só sem o ganho da triagem. Verificar o nome correto no primeiro teste com PDF real.
