# Tela de Administração de Regras — Plano de Implementação

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: Use superpowers:executing-plans para implementar este plano tarefa por tarefa. Os passos usam sintaxe de checkbox (`- [ ]`) para rastreamento.

**Objetivo:** Tela `/admin` protegida por senha que mostra e permite editar/salvar os itens de checklist (Regularidade + Instrução) de cada segmento×modalidade, com persistência em arquivo JSON num volume Railway.

**Arquitetura:** As regras saem do código (`segment-rules.ts`) e viram um store JSON (`rules.json`) lido com cache em memória, com seed/fallback nas regras hardcoded (`default-rules.ts`). O pipeline de análise passa a resolver o checklist do store. A tela `/admin` (server component) protege via cookie HMAC; o editor (client component) salva combinações via API.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod v4, Vitest, Node `crypto`/`fs`.

---

## Arquivos afetados

- Criar: `src/lib/default-rules.ts`, `src/lib/rules-store.ts`, `src/lib/admin-auth.ts`
- Criar: `src/app/api/admin/login/route.ts`, `src/app/api/admin/rules/route.ts`
- Criar: `src/app/admin/page.tsx`, `src/components/AdminLogin.tsx`, `src/components/RulesEditor.tsx`
- Criar testes: `tests/unit/default-rules.test.ts`, `tests/unit/rules-store.test.ts`, `tests/unit/admin-auth.test.ts`, `tests/unit/segment-rules.test.ts`
- Modificar: `src/lib/segment-rules.ts`, `src/lib/prompt.ts`, `src/lib/triage.ts`, `src/lib/claude-analyzer.ts`, `src/app/globals.css`, `.gitignore`, `.env.example`

---

## Tarefa 1: `default-rules.ts` — mover regras e gerar DEFAULT_RULES

**Arquivos:**
- Criar: `src/lib/default-rules.ts`
- Modificar: `src/lib/segment-rules.ts`
- Criar: `tests/unit/default-rules.test.ts`

- [ ] **Passo 1: Criar `src/lib/default-rules.ts`**

Mover (recortar) de `src/lib/segment-rules.ts` para este novo arquivo, **na ordem original e sem alterar o conteúdo**, as seguintes definições:
- As interfaces `ChecklistItem` e `SegmentChecklist`
- Os blocos: `REGULARIDADE_PJ`, `REGULARIDADE_PJ_COM_CNDT`, `INSTRUCAO_SOLICITACAO`, `INSTRUCAO_NF`, `INSTRUCAO_OS`, `INSTRUCAO_RAF`, `INSTRUCAO_KIT_CONTRATO`, `INSTRUCAO_MANIFESTACAO`, `INSTRUCAO_CONTABIL`, `INSTRUCAO_PLANO_OPERATIVO`, `INSTRUCAO_PARECER_INDENIZATORIO`
- As funções `buildFornecedor`, `buildCessaoMaoObra`, `buildEngenharia`, `buildServicosMedicos`, `buildLocacaoPF`, `buildLocacaoPJ`, `buildMonopolio`

No topo do arquivo, o import deve ser:

```typescript
import { SEGMENTOS, type SegmentoId, type Modalidade } from '@/lib/types';
```

As interfaces movidas devem ser **exportadas**:

```typescript
export interface ChecklistItem {
  descricao: string;
  detalhe: string;
}

export interface SegmentChecklist {
  regularidade: ChecklistItem[];
  instrucao: ChecklistItem[];
}
```

Ao final do arquivo (após os blocos e funções movidos), adicionar o tipo do store, o resolvedor e o `DEFAULT_RULES`:

```typescript
// Store: combinações válidas de segmento × modalidade já resolvidas (lista plana).
export type RulesStore = {
  [segmentoId: string]: {
    [modalidade: string]: SegmentChecklist;
  };
};

/** Resolve a combinação a partir das funções de build (lógica original). */
function resolveDefault(segmento: SegmentoId, modalidade: Modalidade): SegmentChecklist {
  switch (segmento) {
    case 'fornecedor':       return buildFornecedor(modalidade);
    case 'cessao_mao_obra':  return buildCessaoMaoObra(modalidade);
    case 'engenharia':       return buildEngenharia();
    case 'servicos_medicos': return buildServicosMedicos(modalidade);
    case 'locacao_pf':       return buildLocacaoPF();
    case 'locacao_pj':       return buildLocacaoPJ();
    case 'monopolio':        return buildMonopolio();
  }
}

/** Conjunto padrão (seed + fallback): todas as combinações válidas resolvidas. */
export const DEFAULT_RULES: RulesStore = (() => {
  const store: RulesStore = {};
  for (const seg of SEGMENTOS) {
    store[seg.id] = {};
    for (const mod of seg.modalidades) {
      store[seg.id][mod] = resolveDefault(seg.id, mod as Modalidade);
    }
  }
  return store;
})();
```

- [ ] **Passo 2: Reduzir `src/lib/segment-rules.ts`**

O arquivo, após a remoção dos blocos, deve conter apenas:

```typescript
import { DEFAULT_RULES, type RulesStore, type SegmentChecklist, type ChecklistItem } from '@/lib/default-rules';
import type { SegmentoId, Modalidade } from '@/lib/types';

export type { RulesStore, SegmentChecklist, ChecklistItem };

/**
 * Busca o checklist de uma combinação no store. Fallback em cascata:
 * store → DEFAULT_RULES → primeira modalidade do segmento → vazio.
 */
export function getSegmentChecklist(
  store: RulesStore,
  segmento: SegmentoId,
  modalidade: Modalidade,
): SegmentChecklist {
  return (
    store[segmento]?.[modalidade] ??
    DEFAULT_RULES[segmento]?.[modalidade] ??
    Object.values(DEFAULT_RULES[segmento] ?? {})[0] ??
    { regularidade: [], instrucao: [] }
  );
}

export function getSegmentLabel(segmento: SegmentoId): string {
  const found = [
    { id: 'fornecedor', label: 'Fornecedor (materiais / serviços)' },
    { id: 'cessao_mao_obra', label: 'Cessão de Mão de Obra (terceirização)' },
    { id: 'engenharia', label: 'Serviços de Engenharia' },
    { id: 'servicos_medicos', label: 'Serviços Médicos' },
    { id: 'locacao_pf', label: 'Locação de Imóvel — Pessoa Física' },
    { id: 'locacao_pj', label: 'Locação de Imóvel — Pessoa Jurídica' },
    { id: 'monopolio', label: 'Monopólio / Locação em geral' },
  ].find((s) => s.id === segmento);
  return found?.label ?? segmento;
}
```

> Nota: `getSegmentChecklist` mudou de assinatura — agora recebe `store`. Os consumidores (`prompt.ts`, `triage.ts`, `claude-analyzer.ts`) serão atualizados na Tarefa 3. Por isso o build pode falhar ao final desta tarefa; rode apenas os testes unitários no Passo 4.

- [ ] **Passo 3: Escrever o teste**

`tests/unit/default-rules.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { DEFAULT_RULES } from '@/lib/default-rules';
import { getSegmentChecklist } from '@/lib/segment-rules';

describe('DEFAULT_RULES', () => {
  it('contém todas as combinações válidas de segmento × modalidade', () => {
    expect(Object.keys(DEFAULT_RULES).sort()).toEqual([
      'cessao_mao_obra', 'engenharia', 'fornecedor', 'locacao_pf',
      'locacao_pj', 'monopolio', 'servicos_medicos',
    ]);
    expect(Object.keys(DEFAULT_RULES.fornecedor).sort()).toEqual(['contrato', 'indenizatorio']);
    expect(Object.keys(DEFAULT_RULES.engenharia)).toEqual(['contrato']);
  });

  it('fornecedor/contrato tem itens de regularidade e instrução', () => {
    const c = DEFAULT_RULES.fornecedor.contrato;
    expect(c.regularidade.length).toBeGreaterThan(0);
    expect(c.instrucao.length).toBeGreaterThan(0);
    expect(c.regularidade[0]).toHaveProperty('descricao');
    expect(c.regularidade[0]).toHaveProperty('detalhe');
  });

  it('getSegmentChecklist resolve do store e faz fallback ao default', () => {
    const custom = { regularidade: [{ descricao: 'X', detalhe: 'Y' }], instrucao: [] };
    const store = { fornecedor: { contrato: custom } };
    expect(getSegmentChecklist(store, 'fornecedor', 'contrato')).toEqual(custom);
    // combinação ausente no store → cai no DEFAULT_RULES
    expect(getSegmentChecklist(store, 'engenharia', 'contrato'))
      .toEqual(DEFAULT_RULES.engenharia.contrato);
  });
});
```

- [ ] **Passo 4: Rodar os testes**

Run: `npm run test -- default-rules`
Expected: PASS (3 testes).

- [ ] **Passo 5: Commit**

```bash
git add src/lib/default-rules.ts src/lib/segment-rules.ts tests/unit/default-rules.test.ts
git commit -m "refactor: extrai DEFAULT_RULES para default-rules.ts; getSegmentChecklist recebe store"
```

---

## Tarefa 2: `rules-store.ts` — persistência JSON + cache + schemas

**Arquivos:**
- Criar: `src/lib/rules-store.ts`
- Criar: `tests/unit/rules-store.test.ts`

- [ ] **Passo 1: Escrever os testes**

`tests/unit/rules-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  mergeWithDefaults,
  getRulesStore,
  saveCombination,
  resetRulesCache,
  CombinationPayloadSchema,
} from '@/lib/rules-store';
import { DEFAULT_RULES } from '@/lib/default-rules';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rules-'));
  process.env.RULES_STORE_PATH = path.join(tmpDir, 'rules.json');
  resetRulesCache();
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  delete process.env.RULES_STORE_PATH;
});

describe('mergeWithDefaults', () => {
  it('usa override válido e mantém default nas demais combinações', () => {
    const custom = { regularidade: [{ descricao: 'X', detalhe: 'Y' }], instrucao: [] };
    const merged = mergeWithDefaults({ fornecedor: { contrato: custom } });
    expect(merged.fornecedor.contrato).toEqual(custom);
    expect(merged.engenharia.contrato).toEqual(DEFAULT_RULES.engenharia.contrato);
  });

  it('ignora combinação inválida e cai no default', () => {
    const merged = mergeWithDefaults({ fornecedor: { contrato: { lixo: true } } });
    expect(merged.fornecedor.contrato).toEqual(DEFAULT_RULES.fornecedor.contrato);
  });
});

describe('getRulesStore + saveCombination', () => {
  it('faz seed do arquivo quando ausente', async () => {
    const store = await getRulesStore();
    expect(store.fornecedor.contrato).toEqual(DEFAULT_RULES.fornecedor.contrato);
    const onDisk = await fs.readFile(process.env.RULES_STORE_PATH!, 'utf-8');
    expect(JSON.parse(onDisk)).toHaveProperty('fornecedor');
  });

  it('persiste e relê uma combinação salva', async () => {
    const novo = { regularidade: [{ descricao: 'Novo', detalhe: 'Detalhe' }], instrucao: [] };
    await saveCombination('fornecedor', 'contrato', novo);
    resetRulesCache();
    const store = await getRulesStore();
    expect(store.fornecedor.contrato).toEqual(novo);
  });
});

describe('CombinationPayloadSchema', () => {
  it('aceita payload válido', () => {
    const r = CombinationPayloadSchema.safeParse({
      segmento: 'fornecedor', modalidade: 'contrato',
      checklist: { regularidade: [{ descricao: 'A', detalhe: 'B' }], instrucao: [] },
    });
    expect(r.success).toBe(true);
  });

  it('rejeita item sem descrição', () => {
    const r = CombinationPayloadSchema.safeParse({
      segmento: 'fornecedor', modalidade: 'contrato',
      checklist: { regularidade: [{ descricao: '', detalhe: 'B' }], instrucao: [] },
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Passo 2: Rodar os testes para confirmar que falham**

Run: `npm run test -- rules-store`
Expected: FAIL com erro de import (`@/lib/rules-store` não existe).

- [ ] **Passo 3: Implementar `src/lib/rules-store.ts`**

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { DEFAULT_RULES, type RulesStore, type SegmentChecklist } from '@/lib/default-rules';
import { SEGMENTOS, type SegmentoId, type Modalidade } from '@/lib/types';
import { logger } from '@/lib/logger';

export const ChecklistItemSchema = z.object({
  descricao: z.string().min(1),
  detalhe: z.string(),
});

export const SegmentChecklistSchema = z.object({
  regularidade: z.array(ChecklistItemSchema),
  instrucao: z.array(ChecklistItemSchema),
});

export const CombinationPayloadSchema = z.object({
  segmento: z.enum(['fornecedor', 'cessao_mao_obra', 'engenharia', 'servicos_medicos', 'locacao_pf', 'locacao_pj', 'monopolio']),
  modalidade: z.enum(['contrato', 'indenizatorio']),
  checklist: SegmentChecklistSchema,
});

function getStorePath(): string {
  return process.env.RULES_STORE_PATH ?? path.join(process.cwd(), 'data', 'rules.json');
}

let cache: RulesStore | null = null;

/** Apenas para testes — limpa o cache em memória. */
export function resetRulesCache(): void {
  cache = null;
}

/** Mescla o conteúdo lido do arquivo com os defaults: combinações ausentes
 *  ou inválidas herdam DEFAULT_RULES. Função pura. */
export function mergeWithDefaults(parsed: unknown): RulesStore {
  const result: RulesStore = {};
  for (const seg of SEGMENTOS) {
    result[seg.id] = {};
    for (const mod of seg.modalidades) {
      const candidate = (parsed as Record<string, Record<string, unknown>> | null)?.[seg.id]?.[mod];
      const check = SegmentChecklistSchema.safeParse(candidate);
      result[seg.id][mod] = check.success ? check.data : DEFAULT_RULES[seg.id][mod];
    }
  }
  return result;
}

async function atomicWrite(store: RulesStore): Promise<void> {
  const p = getStorePath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf-8');
  await fs.rename(tmp, p);
}

/** Carrega o store (cacheado). Seed quando ausente; fallback aos defaults
 *  quando ausente ou corrompido — a análise nunca quebra. */
export async function getRulesStore(): Promise<RulesStore> {
  if (cache) return cache;
  const p = getStorePath();
  try {
    const raw = await fs.readFile(p, 'utf-8');
    cache = mergeWithDefaults(JSON.parse(raw));
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'rules_store_seed_or_fallback');
    cache = mergeWithDefaults({});
    try {
      await atomicWrite(cache);
    } catch (writeErr) {
      logger.error({ err: writeErr instanceof Error ? writeErr.message : String(writeErr) }, 'rules_store_seed_write_failed');
    }
  }
  return cache;
}

/** Salva uma combinação e atualiza o cache. */
export async function saveCombination(
  segmento: SegmentoId,
  modalidade: Modalidade,
  checklist: SegmentChecklist,
): Promise<void> {
  const store = await getRulesStore();
  const next: RulesStore = structuredClone(store);
  next[segmento] = { ...(next[segmento] ?? {}), [modalidade]: checklist };
  await atomicWrite(next);
  cache = next;
}
```

- [ ] **Passo 4: Rodar os testes para confirmar que passam**

Run: `npm run test -- rules-store`
Expected: PASS (6 testes).

- [ ] **Passo 5: Commit**

```bash
git add src/lib/rules-store.ts tests/unit/rules-store.test.ts
git commit -m "feat: rules-store (persistencia JSON com cache, seed e validacao)"
```

---

## Tarefa 3: Integrar o store no pipeline de análise

**Arquivos:**
- Modificar: `src/lib/prompt.ts`, `src/lib/triage.ts`, `src/lib/claude-analyzer.ts`

- [ ] **Passo 1: `prompt.ts` — builders recebem o checklist resolvido**

Substituir o import do topo e as duas funções exportadas:

```typescript
import { getSegmentLabel, type SegmentChecklist, type ChecklistItem } from '@/lib/segment-rules';
import type { SegmentoId, Modalidade } from '@/lib/types';
```

`buildSystemPrompt` passa a receber `checklist`:

```typescript
export function buildSystemPrompt(checklist: SegmentChecklist, segmento: SegmentoId, modalidade: Modalidade): string {
  const segLabel = getSegmentLabel(segmento);
  const modLabel = modalidade === 'contrato' ? 'Contrato' : 'Indenizatório';
  const nReg = checklist.regularidade.length;
  const nInstr = checklist.instrucao.length;
  const nTotal = nReg + nInstr;
```

(o restante do corpo de `buildSystemPrompt` permanece idêntico, incluindo `formatItems`, `BASE_LEGAL`, `STATUS_RULES`, `KNOWN_VARIANTS`, a `DATA DE HOJE` e as `INSTRUÇÕES DE ANÁLISE`.)

`buildUserPrompt` passa a receber `checklist`:

```typescript
export function buildUserPrompt(extractedText: string, checklist: SegmentChecklist): string {
  const nTotal = checklist.regularidade.length + checklist.instrucao.length;
  return `Analise o processo administrativo de pagamento a seguir e preencha todos os ${nTotal} itens do checklist de conformidade via tool call "submit_analysis".

Texto extraído do PDF (por página):
${extractedText}`;
}
```

A função `formatItems` continua usando `ChecklistItem` (já importado).

- [ ] **Passo 2: `claude-analyzer.ts` — carregar store em `runAnalysisOnText`**

Adicionar imports no topo:

```typescript
import { getRulesStore } from '@/lib/rules-store';
import { getSegmentChecklist } from '@/lib/segment-rules';
```

No início de `runAnalysisOnText`, substituir as duas linhas que montam os prompts:

```typescript
async function runAnalysisOnText(
  focusedText: string,
  segmento: SegmentoId,
  modalidade: Modalidade,
): Promise<AnalysisResult> {
  const store = await getRulesStore();
  const checklist = getSegmentChecklist(store, segmento, modalidade);
  const systemPrompt = buildSystemPrompt(checklist, segmento, modalidade);
  const userPrompt = buildUserPrompt(focusedText, checklist);
  let lastError: Error | null = null;
  // ... (restante inalterado)
```

- [ ] **Passo 3: `triage.ts` — carregar store em `triagePages`**

Atualizar imports no topo (trocar `getSegmentChecklist` por `getRulesStore` + manter `getSegmentLabel`):

```typescript
import { getRulesStore } from '@/lib/rules-store';
import { getSegmentChecklist, getSegmentLabel, type SegmentChecklist } from '@/lib/segment-rules';
```

`buildTriageSystemPrompt` passa a receber `checklist`:

```typescript
function buildTriageSystemPrompt(checklist: SegmentChecklist, segmento: SegmentoId): string {
  const tipos = [...checklist.regularidade, ...checklist.instrucao]
    .map((it) => `- ${it.descricao}`)
    .join('\n');

  return `Você é um pré-triador de documentos da GCIF/EMSERH. Sua tarefa é APENAS localizar em quais páginas aparecem documentos relevantes para a auditoria de um processo de pagamento do segmento "${getSegmentLabel(segmento)}".
```

(o restante do corpo do prompt de triagem permanece idêntico.)

Em `triagePages`, montar o checklist a partir do store antes de construir o system prompt:

```typescript
export async function triagePages(
  pages: ExtractedPage[],
  segmento: SegmentoId,
  modalidade: Modalidade,
  onProgress?: (done: number, total: number) => void,
): Promise<TriageResult> {
  const chunks = chunkPages(pages, CHUNK_SIZE);
  const store = await getRulesStore();
  const checklist = getSegmentChecklist(store, segmento, modalidade);
  const system = buildTriageSystemPrompt(checklist, segmento);
  let done = 0;
  // ... (restante inalterado)
```

- [ ] **Passo 4: Verificar build e testes**

Run: `npm run build`
Expected: PASS — sem erros de tipo.

Run: `npm run test`
Expected: PASS em todos (incluindo default-rules, rules-store, triage, select-relevant-pages).

- [ ] **Passo 5: Commit**

```bash
git add src/lib/prompt.ts src/lib/claude-analyzer.ts src/lib/triage.ts
git commit -m "feat: pipeline de analise resolve checklist do rules-store"
```

---

## Tarefa 4: `admin-auth.ts` — senha + token HMAC

**Arquivos:**
- Criar: `src/lib/admin-auth.ts`
- Criar: `tests/unit/admin-auth.test.ts`

- [ ] **Passo 1: Escrever os testes**

`tests/unit/admin-auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkPassword, makeAuthToken, verifyAuthToken } from '@/lib/admin-auth';

beforeEach(() => { process.env.ADMIN_PASSWORD = 'senha-secreta'; });
afterEach(() => { delete process.env.ADMIN_PASSWORD; });

describe('checkPassword', () => {
  it('aceita a senha correta e rejeita a errada', () => {
    expect(checkPassword('senha-secreta')).toBe(true);
    expect(checkPassword('errada')).toBe(false);
  });

  it('rejeita tudo quando ADMIN_PASSWORD não está definida', () => {
    delete process.env.ADMIN_PASSWORD;
    expect(checkPassword('qualquer')).toBe(false);
  });
});

describe('token de autenticação', () => {
  it('gera token estável e verifica corretamente', () => {
    const token = makeAuthToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyAuthToken(token)).toBe(true);
  });

  it('rejeita token inválido ou ausente', () => {
    expect(verifyAuthToken('token-falso')).toBe(false);
    expect(verifyAuthToken(undefined)).toBe(false);
    expect(verifyAuthToken('')).toBe(false);
  });
});
```

- [ ] **Passo 2: Rodar os testes para confirmar que falham**

Run: `npm run test -- admin-auth`
Expected: FAIL com erro de import.

- [ ] **Passo 3: Implementar `src/lib/admin-auth.ts`**

```typescript
import crypto from 'node:crypto';

const TOKEN_SUBJECT = 'emserh-admin-v1';

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Compara a senha informada com ADMIN_PASSWORD (tempo constante). */
export function checkPassword(pwd: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(pwd, expected);
}

/** Token de sessão = HMAC-SHA256(TOKEN_SUBJECT) usando ADMIN_PASSWORD como chave. */
export function makeAuthToken(): string {
  const secret = process.env.ADMIN_PASSWORD ?? '';
  return crypto.createHmac('sha256', secret).update(TOKEN_SUBJECT).digest('hex');
}

/** Verifica se o token do cookie corresponde ao token esperado. */
export function verifyAuthToken(token: string | undefined | null): boolean {
  if (!token) return false;
  if (!process.env.ADMIN_PASSWORD) return false;
  return safeEqual(token, makeAuthToken());
}
```

- [ ] **Passo 4: Rodar os testes para confirmar que passam**

Run: `npm run test -- admin-auth`
Expected: PASS (4 testes).

- [ ] **Passo 5: Commit**

```bash
git add src/lib/admin-auth.ts tests/unit/admin-auth.test.ts
git commit -m "feat: admin-auth (senha + token HMAC de sessao)"
```

---

## Tarefa 5: Rotas de API do admin

**Arquivos:**
- Criar: `src/app/api/admin/login/route.ts`
- Criar: `src/app/api/admin/rules/route.ts`

- [ ] **Passo 1: Criar `src/app/api/admin/login/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { checkPassword, makeAuthToken } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const senha = typeof body?.senha === 'string' ? body.senha : '';

  if (!checkPassword(senha)) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_auth', makeAuthToken(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return res;
}
```

- [ ] **Passo 2: Criar `src/app/api/admin/rules/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthToken } from '@/lib/admin-auth';
import { getRulesStore, saveCombination, CombinationPayloadSchema } from '@/lib/rules-store';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function isAuthed(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyAuthToken(cookieStore.get('admin_auth')?.value);
}

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const store = await getRulesStore();
  return NextResponse.json({ store });
}

export async function POST(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const parsed = CombinationPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.issues }, { status: 400 });
  }
  try {
    await saveCombination(parsed.data.segmento, parsed.data.modalidade, parsed.data.checklist);
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'rules_save_failed');
    return NextResponse.json({ error: 'Falha ao salvar as regras' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Passo 3: Verificar build**

Run: `npm run build`
Expected: PASS. Se houver erro relacionado a `cookies()` (API assíncrona do Next 16), conferir `node_modules/next/dist/docs/` — `cookies()` deve ser aguardado com `await`, como já feito acima.

- [ ] **Passo 4: Commit**

```bash
git add src/app/api/admin/login/route.ts src/app/api/admin/rules/route.ts
git commit -m "feat: rotas de API do admin (login + GET/POST rules protegidos)"
```

---

## Tarefa 6: Tela `/admin` (login + editor)

**Arquivos:**
- Criar: `src/app/admin/page.tsx`, `src/components/AdminLogin.tsx`, `src/components/RulesEditor.tsx`
- Modificar: `src/app/globals.css`

- [ ] **Passo 1: Criar `src/app/admin/page.tsx`**

```typescript
import { cookies } from 'next/headers';
import { verifyAuthToken } from '@/lib/admin-auth';
import { getRulesStore } from '@/lib/rules-store';
import { AdminLogin } from '@/components/AdminLogin';
import { RulesEditor } from '@/components/RulesEditor';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const cookieStore = await cookies();
  const authed = verifyAuthToken(cookieStore.get('admin_auth')?.value);

  if (!authed) {
    return <AdminLogin />;
  }

  const store = await getRulesStore();
  return <RulesEditor initialStore={store} />;
}
```

- [ ] **Passo 2: Criar `src/components/AdminLogin.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminLogin() {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha }),
    });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      setErro('Senha incorreta.');
    }
  }

  return (
    <main className="admin-login">
      <form className="card admin-login-card" onSubmit={submit}>
        <div className="card-head"><div className="card-title">Administração de Regras</div></div>
        <div className="card-body">
          <label className="segment-label" htmlFor="senha">Senha de administrador</label>
          <input
            id="senha"
            type="password"
            className="admin-input"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoFocus
          />
          {erro && <p className="admin-error">{erro}</p>}
          <button className="btn-primary" type="submit" disabled={loading || !senha}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </form>
    </main>
  );
}
```

- [ ] **Passo 3: Criar `src/components/RulesEditor.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { SEGMENTOS, type SegmentoId, type Modalidade } from '@/lib/types';
import type { RulesStore, SegmentChecklist } from '@/lib/default-rules';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function emptyChecklist(): SegmentChecklist {
  return { regularidade: [], instrucao: [] };
}

export function RulesEditor({ initialStore }: { initialStore: RulesStore }) {
  const [store, setStore] = useState<RulesStore>(initialStore);
  const [segmento, setSegmento] = useState<SegmentoId>(SEGMENTOS[0].id);
  const segConfig = SEGMENTOS.find((s) => s.id === segmento)!;
  const [modalidade, setModalidade] = useState<Modalidade>(segConfig.modalidades[0] as Modalidade);
  const [draft, setDraft] = useState<SegmentChecklist>(
    () => structuredClone(initialStore[segmento]?.[modalidade] ?? emptyChecklist()),
  );
  const [status, setStatus] = useState<SaveStatus>('idle');

  function reload(s: SegmentoId, m: Modalidade, src: RulesStore = store) {
    setDraft(structuredClone(src[s]?.[m] ?? emptyChecklist()));
    setStatus('idle');
  }

  function changeSegmento(novo: SegmentoId) {
    const cfg = SEGMENTOS.find((s) => s.id === novo)!;
    const novaMod = (cfg.modalidades.includes(modalidade) ? modalidade : cfg.modalidades[0]) as Modalidade;
    setSegmento(novo);
    setModalidade(novaMod);
    reload(novo, novaMod);
  }

  function changeModalidade(m: Modalidade) {
    setModalidade(m);
    reload(segmento, m);
  }

  function editItem(lista: keyof SegmentChecklist, i: number, campo: 'descricao' | 'detalhe', valor: string) {
    setDraft((d) => {
      const next = structuredClone(d);
      next[lista][i][campo] = valor;
      return next;
    });
  }

  function addItem(lista: keyof SegmentChecklist) {
    setDraft((d) => {
      const next = structuredClone(d);
      next[lista].push({ descricao: '', detalhe: '' });
      return next;
    });
  }

  function removeItem(lista: keyof SegmentChecklist, i: number) {
    setDraft((d) => {
      const next = structuredClone(d);
      next[lista].splice(i, 1);
      return next;
    });
  }

  async function salvar() {
    setStatus('saving');
    const res = await fetch('/api/admin/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segmento, modalidade, checklist: draft }),
    });
    if (res.ok) {
      const next = structuredClone(store);
      next[segmento] = { ...(next[segmento] ?? {}), [modalidade]: structuredClone(draft) };
      setStore(next);
      setStatus('saved');
    } else {
      setStatus('error');
    }
  }

  function renderLista(titulo: string, lista: keyof SegmentChecklist) {
    return (
      <div className="rule-section">
        <div className="rule-section-title">{titulo}</div>
        {draft[lista].map((item, i) => (
          <div key={i} className="rule-item">
            <input
              className="admin-input"
              placeholder="Descrição do documento"
              value={item.descricao}
              onChange={(e) => editItem(lista, i, 'descricao', e.target.value)}
            />
            <textarea
              className="admin-textarea"
              placeholder="Detalhe / critério de conformidade"
              value={item.detalhe}
              onChange={(e) => editItem(lista, i, 'detalhe', e.target.value)}
            />
            <button className="rule-remove" onClick={() => removeItem(lista, i)} aria-label="Remover item">
              Remover
            </button>
          </div>
        ))}
        <button className="btn-secondary" onClick={() => addItem(lista)}>+ Adicionar item</button>
      </div>
    );
  }

  return (
    <main className="admin-editor">
      <div className="card">
        <div className="card-head">
          <div className="card-title">Administração de Regras</div>
        </div>
        <div className="card-body">
          <div className="segment-row">
            <div className="segment-field">
              <label className="segment-label" htmlFor="adm-seg">Segmento</label>
              <select id="adm-seg" className="segment-select" value={segmento}
                onChange={(e) => changeSegmento(e.target.value as SegmentoId)}>
                {SEGMENTOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="segment-field">
              <label className="segment-label" htmlFor="adm-mod">Modalidade</label>
              <select id="adm-mod" className="segment-select" value={modalidade}
                onChange={(e) => changeModalidade(e.target.value as Modalidade)}>
                {segConfig.modalidades.includes('contrato') && <option value="contrato">Contrato</option>}
                {segConfig.modalidades.includes('indenizatorio') && <option value="indenizatorio">Indenizatório</option>}
              </select>
            </div>
          </div>

          {renderLista('Regularidade Fiscal e Trabalhista', 'regularidade')}
          {renderLista('Instrução Processual', 'instrucao')}

          <div className="admin-actions">
            {status === 'saved' && <span className="admin-saved">✓ Regras atualizadas</span>}
            {status === 'error' && <span className="admin-error">Não foi possível salvar, tente novamente.</span>}
            <button className="btn-secondary" onClick={() => reload(segmento, modalidade)}>Cancelar</button>
            <button className="btn-primary" onClick={salvar} disabled={status === 'saving'}>
              {status === 'saving' ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Passo 4: Adicionar estilos em `src/app/globals.css`**

Adicionar antes de `/* ===== Responsive ===== */`:

```css
  /* ===== Admin ===== */
  .admin-login { max-width: 420px; margin: 80px auto; padding: 0 20px; }
  .admin-editor { max-width: 820px; margin: 40px auto; padding: 0 20px; }
  .admin-input { width: 100%; border: 1px solid var(--em-border); border-radius: 8px; padding: 9px 12px; font-size: 13px; font-family: var(--font-sans); color: var(--ink-1); margin-bottom: 6px; }
  .admin-input:focus { outline: none; border-color: var(--emserh-navy); box-shadow: 0 0 0 3px rgba(10,35,81,0.08); }
  .admin-textarea { width: 100%; min-height: 56px; border: 1px solid var(--em-border); border-radius: 8px; padding: 9px 12px; font-size: 12.5px; font-family: var(--font-sans); color: var(--ink-2); resize: vertical; }
  .admin-error { color: var(--err); font-size: 12.5px; margin: 6px 0; }
  .admin-saved { color: var(--ok); font-size: 12.5px; font-weight: 600; }
  .rule-section { margin-top: 22px; }
  .rule-section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--emserh-navy); margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid var(--line-2); }
  .rule-item { padding: 12px; border: 1px solid var(--line-2); border-radius: 8px; margin-bottom: 10px; background: var(--paper-soft); }
  .rule-remove { background: none; border: 0; color: var(--err); font-size: 11.5px; cursor: pointer; padding: 2px 0; font-family: inherit; }
  .admin-actions { display: flex; align-items: center; gap: 12px; justify-content: flex-end; margin-top: 24px; flex-wrap: wrap; }
```

- [ ] **Passo 5: Verificar build**

Run: `npm run build`
Expected: PASS. A rota `/admin` deve aparecer na listagem de rotas.

- [ ] **Passo 6: Commit**

```bash
git add src/app/admin/page.tsx src/components/AdminLogin.tsx src/components/RulesEditor.tsx src/app/globals.css
git commit -m "feat: tela /admin (login + editor de regras por segmento/modalidade)"
```

---

## Tarefa 7: Configuração de ambiente + verificação final

**Arquivos:**
- Modificar: `.gitignore`, `.env.example`

- [ ] **Passo 1: Atualizar `.gitignore`**

Adicionar ao final:

```
# Store de regras (persistido em volume Railway, não versionado)
/data/
```

- [ ] **Passo 2: Atualizar `.env.example`**

Adicionar ao final:

```
# Admin (tela de regras)
ADMIN_PASSWORD=troque-esta-senha
# Caminho do arquivo de regras (em produção, aponte para o volume Railway, ex: /data/rules.json)
RULES_STORE_PATH=
```

- [ ] **Passo 3: Build limpo + suíte completa**

Run: `npm run build`
Expected: build completa sem erros; rota `/admin` listada.

Run: `npm run test`
Expected: PASS em todos (default-rules, rules-store, admin-auth, segment-rules e os pré-existentes).

- [ ] **Passo 4: Commit + push**

```bash
git add .gitignore .env.example
git commit -m "chore: env e gitignore para admin de regras (ADMIN_PASSWORD, /data)"
git push
```

- [ ] **Passo 5: Configuração manual no Railway (instrução ao usuário)**

Informar ao usuário que, no painel do Railway, é preciso:
1. Adicionar um **Volume** ao serviço, montado em `/data`.
2. Definir a variável `RULES_STORE_PATH=/data/rules.json`.
3. Definir a variável `ADMIN_PASSWORD` com a senha desejada.

Sem o volume, a edição funciona durante a sessão mas é perdida no próximo deploy.

---

## Auto-revisão (preenchida pelo autor do plano)

**Cobertura do spec:**
- Persistência JSON em volume + seed dos defaults → Tarefas 1 e 2 ✅
- Modelo de dados resolvido (combinações planas) → Tarefa 1 (`DEFAULT_RULES`) ✅
- `getSegmentChecklist(store,…)` + integração no pipeline → Tarefas 1 e 3 ✅
- Autenticação por senha + cookie HMAC → Tarefas 4, 5, 6 ✅
- Tela mostrar + editar (segmento/modalidade, add/edit/remove, salvar) → Tarefa 6 ✅
- Tratamento de erros (fallback default, gravação atômica, Zod, senha errada) → Tarefas 2, 4, 5 ✅
- Premissa instância única / cache → documentada no spec, cache em Tarefa 2 ✅
- Config de infra (volume, env vars) → Tarefa 7 ✅

**Consistência de tipos:**
- `ChecklistItem`, `SegmentChecklist`, `RulesStore` definidos em `default-rules.ts` (Tarefa 1) e reexportados por `segment-rules.ts`; usados em `rules-store.ts`, `prompt.ts`, `triage.ts`, `RulesEditor.tsx` ✅
- `getSegmentChecklist(store, segmento, modalidade)` — nova assinatura na Tarefa 1, consumida na Tarefa 3 ✅
- `getRulesStore()`, `saveCombination()`, `CombinationPayloadSchema`, `resetRulesCache()` — definidos na Tarefa 2, usados nas Tarefas 3 e 5 ✅
- `checkPassword`, `makeAuthToken`, `verifyAuthToken` — Tarefa 4, usados nas Tarefas 5 e 6 ✅
- `buildSystemPrompt(checklist, segmento, modalidade)` e `buildUserPrompt(extractedText, checklist)` — Tarefa 3, consistentes com a chamada em `claude-analyzer.ts` ✅

**Risco conhecido:** `cookies()` é assíncrono no Next 16 — já tratado com `await` nas Tarefas 5 e 6. O build (Passos de verificação) detecta qualquer divergência de API.
