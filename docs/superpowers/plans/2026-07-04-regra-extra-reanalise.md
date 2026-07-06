# Regra Específica + Reanálise — Plano de Implementação

> SUB-SKILL: superpowers:executing-plans. Passos com checkbox.

**Objetivo:** Escrever uma regra livre após a análise e reanalisar o documento inteiro com ela, reaproveitando o texto extraído; a regra fica registrada no relatório.

**Arquitetura:** `runAnalysisOnText` aceita `regraExtra`; `analyzeProcess` devolve o texto usado; endpoint `/api/reanalyze` roda só a fase de análise; relatório mostra a regra aplicada.

---

## Tarefa 1: `prompt.ts` aceita regra extra + teste

**Arquivos:** Modificar `src/lib/prompt.ts`; Criar `tests/unit/prompt-regra.test.ts`

- [ ] **Passo 1: Teste**

```typescript
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '@/lib/prompt';
import { DEFAULT_RULES } from '@/lib/default-rules';

const checklist = DEFAULT_RULES.fornecedor.contrato;

describe('buildSystemPrompt com regra extra', () => {
  it('sem regra extra não inclui a seção adicional', () => {
    const p = buildSystemPrompt(checklist, 'fornecedor', 'contrato');
    expect(p).not.toContain('REGRA ADICIONAL');
  });
  it('com regra extra inclui a seção e o texto', () => {
    const p = buildSystemPrompt(checklist, 'fornecedor', 'contrato', 'verificar autorização do gestor');
    expect(p).toContain('REGRA ADICIONAL');
    expect(p).toContain('verificar autorização do gestor');
  });
});
```

- [ ] **Passo 2: Rodar (falha):** `npm run test -- prompt-regra` → FAIL

- [ ] **Passo 3: Implementar** — em `src/lib/prompt.ts`, alterar a assinatura e inserir a seção.

Trocar a assinatura de `buildSystemPrompt`:

```typescript
export function buildSystemPrompt(checklist: SegmentChecklist, segmento: SegmentoId, modalidade: Modalidade, regraExtra?: string): string {
```

Logo antes da linha `INSTRUÇÕES DE ANÁLISE:` no template, inserir (interpolação):

```typescript
${regraExtra && regraExtra.trim() ? `REGRA ADICIONAL ESPECÍFICA DESTA ANÁLISE (definida manualmente pelo auditor):
"${regraExtra.trim()}"
- Avalie o documento também segundo esta regra e inclua o resultado como um item adicional na Instrução Processual.
- Se esta regra alterar uma exigência existente (ex.: dispensar um documento antes exigido), REAVALIE o item correspondente à luz dela.

` : ''}INSTRUÇÕES DE ANÁLISE:
```

- [ ] **Passo 4: Rodar (passa):** `npm run test -- prompt-regra` → PASS (2 testes)

- [ ] **Passo 5: Commit**

```bash
git add src/lib/prompt.ts tests/unit/prompt-regra.test.ts
git commit -m "feat: buildSystemPrompt aceita regra extra por analise"
```

---

## Tarefa 2: `claude-analyzer` — regra extra + retorno do texto

**Arquivos:** Modificar `src/lib/claude-analyzer.ts`, `src/app/api/analyze/route.ts`

- [ ] **Passo 1: `runAnalysisOnText` aceita `regraExtra`**

Alterar a assinatura e a chamada a `buildSystemPrompt`:

```typescript
export async function runAnalysisOnText(
  focusedText: string,
  segmento: SegmentoId,
  modalidade: Modalidade,
  regraExtra?: string,
): Promise<AnalysisResult> {
  const store = await getRulesStore();
  const checklist = getSegmentChecklist(store, segmento, modalidade);
  const systemPrompt = buildSystemPrompt(checklist, segmento, modalidade, regraExtra);
  const userPrompt = buildUserPrompt(focusedText, checklist);
```

(resto do corpo inalterado)

- [ ] **Passo 2: `analyzeProcess` devolve `{ analysis, focusedText }`**

Trocar o tipo de retorno e a última linha:

```typescript
export async function analyzeProcess(
  pages: ExtractedPage[],
  segmento: SegmentoId,
  modalidade: Modalidade,
  progress?: AnalyzeProgress,
): Promise<{ analysis: AnalysisResult; focusedText: string }> {
```

E no final, trocar:

```typescript
  const analysis = await runAnalysisOnText(focusedText, segmento, modalidade);
  return { analysis, focusedText };
```

- [ ] **Passo 3: `analyze/route.ts` usa o novo retorno e envia `focusedText`**

Trocar o bloco da chamada `analyzeProcess`:

```typescript
          let out: Awaited<ReturnType<typeof analyzeProcess>>;
          try {
            out = await analyzeProcess(
              extracted.pages,
              segmento as import('@/lib/types').SegmentoId,
              modalidade as import('@/lib/types').Modalidade,
              {
                triageChunk: (done, total) =>
                  progress('triaging', `Triagem: ${done}/${total} blocos de páginas analisados...`),
                onMessage: (message) => {
                  const stage = message.startsWith('Analisando') ? 'analyzing' : 'triaging';
                  progress(stage, message);
                },
              },
            );
          } finally {
            clearInterval(keepalive);
          }
          const analysis = out.analysis;
          const analyzeMs = Date.now() - t1;
```

E no `results.push`, adicionar `focusedText`:

```typescript
          results.push({
            filename: file.name,
            analysis,
            focusedText: out.focusedText,
            reportPdf: reportPdf.toString('base64'),
            annotatedPdf: annotatedPdf.toString('base64'),
          });
```

- [ ] **Passo 4: Verificar build:** `npm run build` → PASS

- [ ] **Passo 5: Commit**

```bash
git add src/lib/claude-analyzer.ts src/app/api/analyze/route.ts
git commit -m "feat: analyzeProcess devolve texto usado; runAnalysisOnText aceita regra extra"
```

---

## Tarefa 3: Endpoint `/api/reanalyze`

**Arquivos:** Criar `src/app/api/reanalyze/route.ts`

- [ ] **Passo 1: Implementar**

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runAnalysisOnText } from '@/lib/claude-analyzer';
import type { SegmentoId, Modalidade } from '@/lib/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  focusedText: z.string().min(1),
  segmento: z.enum(['fornecedor', 'cessao_mao_obra', 'engenharia', 'servicos_medicos', 'locacao_pf', 'locacao_pj', 'monopolio']),
  modalidade: z.enum(['contrato', 'indenizatorio']),
  regraExtra: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
  try {
    const analysis = await runAnalysisOnText(
      parsed.data.focusedText,
      parsed.data.segmento as SegmentoId,
      parsed.data.modalidade as Modalidade,
      parsed.data.regraExtra,
    );
    return NextResponse.json({ analysis });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'reanalyze_failed');
    return NextResponse.json({ error: 'Falha ao reanalisar' }, { status: 500 });
  }
}
```

- [ ] **Passo 2: Verificar build:** `npm run build` → PASS; rota `/api/reanalyze` listada

- [ ] **Passo 3: Commit**

```bash
git add src/app/api/reanalyze/route.ts
git commit -m "feat: endpoint /api/reanalyze roda analise com regra extra reaproveitando texto"
```

---

## Tarefa 4: Relatório registra a regra aplicada

**Arquivos:** Modificar `src/lib/report-generator.tsx`, `src/app/api/report/route.ts`

- [ ] **Passo 1: `generateConformityReport` aceita `regraExtra`**

Trocar a assinatura de `ConformityDocument` e `generateConformityReport`:

```typescript
function ConformityDocument({ analysis, dispensas, regraExtra }: { analysis: AnalysisResult; dispensas: Dispensa[]; regraExtra?: string }) {
```

E `generateConformityReport`:

```typescript
export async function generateConformityReport(analysis: AnalysisResult, dispensas: Dispensa[] = [], regraExtra?: string): Promise<Buffer> {
  const uint8 = await renderToBuffer(<ConformityDocument analysis={analysis} dispensas={dispensas} regraExtra={regraExtra} />);
  return Buffer.from(uint8);
}
```

- [ ] **Passo 2: Renderizar a nota no PDF** — dentro de `ConformityDocument`, logo após o bloco de `conclusaoBox` (antes da seção de exceções), inserir:

```typescript
        {regraExtra && regraExtra.trim() && (
          <View style={{ marginTop: 8, padding: 8, borderWidth: 1, borderColor: '#1e3a5f', borderRadius: 4 }}>
            <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: '#1e3a5f' }}>REGRA ADICIONAL APLICADA NESTA ANÁLISE</Text>
            <Text style={{ fontSize: 8, color: '#333', marginTop: 2 }}>{regraExtra.trim()}</Text>
          </View>
        )}
```

- [ ] **Passo 3: `/api/report` aceita `regraExtra`** — em `src/app/api/report/route.ts`, ampliar o schema e a chamada:

```typescript
const BodySchema = z.object({
  analysis: AnalysisResultSchema,
  dispensas: z.array(DispensaSchema),
  regraExtra: z.string().optional(),
});
```

E a chamada:

```typescript
    const pdf = await generateConformityReport(parsed.data.analysis, parsed.data.dispensas, parsed.data.regraExtra);
```

- [ ] **Passo 4: Verificar build:** `npm run build` → PASS

- [ ] **Passo 5: Commit**

```bash
git add src/lib/report-generator.tsx src/app/api/report/route.ts
git commit -m "feat: relatorio registra regra adicional aplicada na analise"
```

---

## Tarefa 5: UI de reanálise no `ResultPanel` + `page.tsx` + CSS

**Arquivos:** Modificar `src/components/ResultPanel.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Passo 1: `page.tsx` — repassar `focusedText`, `segmento`, `modalidade`**

No tipo `AnalysisResultEntry`, adicionar `focusedText: string;`. No mapeamento do evento `result`, adicionar `focusedText: r.focusedText`. E no `SSEEvent` do tipo `result`, adicionar `focusedText: string` ao item. No JSX do `ResultPanel`, passar:

```typescript
            <ResultPanel
              key={r.filename}
              filename={r.filename}
              analysis={r.analysis}
              focusedText={r.focusedText}
              segmento={(segmento || 'fornecedor') as SegmentoId}
              modalidade={modalidade}
              reportPdfBase64={r.reportPdfBase64}
              annotatedPdfBase64={r.annotatedPdfBase64}
            />
```

- [ ] **Passo 2: `ResultPanel` — props novas, estado de análise/regra, UI de reanálise**

Ajustar a interface e o corpo:

```typescript
interface ResultPanelProps {
  filename: string;
  analysis: AnalysisResult;
  focusedText: string;
  segmento: import('@/lib/types').SegmentoId;
  modalidade: import('@/lib/types').Modalidade;
  reportPdfBase64: string;
  annotatedPdfBase64: string;
}

export function ResultPanel({ filename, analysis: analysisProp, focusedText, segmento, modalidade, reportPdfBase64, annotatedPdfBase64 }: ResultPanelProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult>(analysisProp);
  const { identificacao_contrato: id, conclusao } = analysis;
  const [dispensas, setDispensas] = useState<Dispensa[]>([]);
  const [auditorNome, setAuditorNome] = useState('');
  const [gerando, setGerando] = useState(false);
  const [erroPdf, setErroPdf] = useState<string | null>(null);
  const [regraExtra, setRegraExtra] = useState<string | null>(null);
  const [regraInput, setRegraInput] = useState('');
  const [reanalisando, setReanalisando] = useState(false);
  const [erroRe, setErroRe] = useState<string | null>(null);
```

Adicionar a função de reanálise (após `desfazer`):

```typescript
  async function reanalisar() {
    if (regraInput.trim().length === 0 || !focusedText) return;
    setReanalisando(true); setErroRe(null);
    try {
      const res = await fetch('/api/reanalyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focusedText, segmento, modalidade, regraExtra: regraInput.trim() }),
      });
      if (!res.ok) throw new Error('falha');
      const { analysis: nova } = await res.json();
      setAnalysis(nova);
      setRegraExtra(regraInput.trim());
      setRegraInput('');
      setDispensas([]);
    } catch {
      setErroRe('Falha ao reanalisar, tente novamente.');
    } finally {
      setReanalisando(false);
    }
  }
```

Alterar `baixarRelatorio` para enviar `regraExtra` quando houver dispensas OU regra:

```typescript
  async function baixarRelatorio() {
    if (dispensas.length === 0 && !regraExtra) {
      downloadBase64(reportPdfBase64, `relatorio-conformidade-${filename}`);
      return;
    }
    setGerando(true); setErroPdf(null);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis, dispensas, regraExtra: regraExtra ?? undefined }),
      });
      if (!res.ok) throw new Error('falha');
      const { reportPdf } = await res.json();
      downloadBase64(reportPdf, `relatorio-conformidade-${filename}`);
    } catch {
      setErroPdf('Falha ao gerar o relatório atualizado, tente novamente.');
    } finally {
      setGerando(false);
    }
  }
```

Adicionar o bloco de reanálise no JSX, logo antes de `{erroPdf && ...}`:

```typescript
        {focusedText && (
          <div className="reanalise-box">
            <div className="reanalise-title">Adicionar regra específica e reanalisar</div>
            {regraExtra && <p className="reanalise-aplicada">Regra aplicada nesta análise: <strong>{regraExtra}</strong></p>}
            <textarea
              className="reanalise-input"
              placeholder="Ex.: verificar se há autorização do gestor da unidade assinada; ou: o documento X não é necessário neste caso"
              value={regraInput}
              onChange={(e) => setRegraInput(e.target.value)}
            />
            {erroRe && <p className="admin-error">{erroRe}</p>}
            <button className="reanalise-btn" onClick={reanalisar} disabled={reanalisando || regraInput.trim().length === 0}>
              {reanalisando ? 'Reanalisando...' : 'Reanalisar com esta regra'}
            </button>
          </div>
        )}
```

- [ ] **Passo 3: CSS** — em `src/app/globals.css`, no bloco "Dispensa de item", adicionar:

```css
  .reanalise-box { margin-top: 18px; padding: 14px 16px; border: 1px dashed var(--em-border); border-radius: 10px; background: var(--paper-soft); }
  .reanalise-title { font-size: 12.5px; font-weight: 700; color: var(--emserh-navy); margin-bottom: 8px; }
  .reanalise-aplicada { font-size: 12px; color: var(--ink-2); margin: 0 0 8px; }
  .reanalise-input { width: 100%; min-height: 58px; border: 1px solid var(--em-border); border-radius: 8px; padding: 9px 12px; font-size: 12.5px; font-family: var(--font-sans); color: var(--ink-2); resize: vertical; }
  .reanalise-input:focus { outline: none; border-color: var(--emserh-navy); box-shadow: 0 0 0 3px rgba(10,35,81,0.08); }
  .reanalise-btn { margin-top: 8px; background: var(--emserh-navy); color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .reanalise-btn:disabled { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Passo 4: Verificar build:** `npm run build` → PASS

- [ ] **Passo 5: Commit**

```bash
git add src/components/ResultPanel.tsx src/app/page.tsx src/app/globals.css
git commit -m "feat: UI de regra especifica + reanalise no resultado"
```

---

## Tarefa 6: Verificação final + push

- [ ] `npm run build` → PASS
- [ ] `npm run test` → PASS
- [ ] `git push`

---

## Auto-revisão

**Cobertura:** regra livre (T5) ✅ · reanálise completa reaproveitando texto (T2+T3) ✅ · registro no relatório (T4) ✅ · reset de dispensas (T5) ✅ · sem persistência ✅

**Consistência:** `buildSystemPrompt(...,regraExtra?)` T1 usado em T2 ✅ · `runAnalysisOnText(...,regraExtra?)` T2 usado em T3 ✅ · `analyzeProcess → {analysis,focusedText}` T2 consumido no route T2 e enviado ao ResultPanel T5 ✅ · `generateConformityReport(analysis,dispensas?,regraExtra?)` T4 chamado em `/api/report` T4 e pelo ResultPanel T5 ✅ · `/api/reanalyze` body T3 = payload do ResultPanel T5 ✅
