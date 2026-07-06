# Dispensa de Item por Análise — Plano de Implementação

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: Use superpowers:executing-plans. Passos com checkbox (`- [ ]`).

**Objetivo:** Permitir dispensar um item NÃO CONFORME numa análise (com justificativa), recalcular a decisão ao vivo e regenerar o relatório PDF registrando a exceção.

**Arquitetura:** Funções puras de recálculo (`dispensation.ts`); relatório PDF regenerado no servidor via `/api/report`; `ResultPanel` guarda as dispensas no estado e regenera o PDF ao baixar. Sem persistência nova.

**Tech Stack:** Next.js 16, TypeScript, Zod, Vitest, @react-pdf/renderer.

---

## Tarefa 1: Funções puras de dispensa (`dispensation.ts`)

**Arquivos:** Criar `src/lib/dispensation.ts`, `tests/unit/dispensation.test.ts`

- [ ] **Passo 1: Teste**

```typescript
import { describe, it, expect } from 'vitest';
import { isDispensado, recomputeConclusao, type Dispensa } from '@/lib/dispensation';
import type { AnalysisResult } from '@/lib/types';

function item(n: number, status: 'CONFORME' | 'NAO_CONFORME' | 'ATENCAO') {
  return { item: n, descricao: `d${n}`, status, motivo: null, documento_verificador: null, citacao: '', pagina_estimada: 1, observacoes: '', sugestao_correcao: null };
}
const analysis = {
  identificacao_contrato: { credor: '', cnpj: '', contrato_numero: '', objeto: '', periodo_referencia: '', processo_sei: '', valor_total: '' },
  regularidade_fiscal_trabalhista: [{ ...item(1, 'CONFORME'), data_validade: null }, { ...item(2, 'NAO_CONFORME'), data_validade: null }],
  instrucao_processual: [item(1, 'ATENCAO'), item(2, 'NAO_CONFORME')],
  conclusao: { decisao_geral: 'NAO_CONFORME', resumo: '', total_itens_conformes: 1, total_itens_nao_conformes: 2, total_itens_atencao: 1, lista_pendencias: [] },
} as unknown as AnalysisResult;

describe('isDispensado', () => {
  it('identifica item por seção e número', () => {
    const d: Dispensa[] = [{ secao: 'reg', item: 2, justificativa: 'x', auditorNome: 'A', dataISO: '2026-07-04T00:00:00Z' }];
    expect(isDispensado(d, 'reg', 2)).toBe(true);
    expect(isDispensado(d, 'inst', 2)).toBe(false);
    expect(isDispensado(d, 'reg', 1)).toBe(false);
  });
});

describe('recomputeConclusao', () => {
  it('sem dispensas mantém os totais e a decisão', () => {
    const r = recomputeConclusao(analysis, []);
    expect(r.naoConformes).toBe(2);
    expect(r.dispensados).toBe(0);
    expect(r.decisao).toBe('NAO_CONFORME');
  });
  it('dispensar 1 de 2 não conformes mantém NAO_CONFORME', () => {
    const r = recomputeConclusao(analysis, [{ secao: 'reg', item: 2, justificativa: 'x', auditorNome: 'A', dataISO: '' }]);
    expect(r.naoConformes).toBe(1);
    expect(r.dispensados).toBe(1);
    expect(r.decisao).toBe('NAO_CONFORME');
  });
  it('dispensar todos os não conformes vira CONFORME', () => {
    const r = recomputeConclusao(analysis, [
      { secao: 'reg', item: 2, justificativa: 'x', auditorNome: 'A', dataISO: '' },
      { secao: 'inst', item: 2, justificativa: 'y', auditorNome: 'A', dataISO: '' },
    ]);
    expect(r.naoConformes).toBe(0);
    expect(r.dispensados).toBe(2);
    expect(r.decisao).toBe('CONFORME');
  });
});
```

- [ ] **Passo 2: Rodar (falha):** `npm run test -- dispensation` → FAIL (módulo não existe)

- [ ] **Passo 3: Implementar `src/lib/dispensation.ts`**

```typescript
import type { AnalysisResult, DecisaoGeral } from '@/lib/types';

export type Secao = 'reg' | 'inst';

export interface Dispensa {
  secao: Secao;
  item: number;
  justificativa: string;
  auditorNome: string;
  dataISO: string;
}

export function isDispensado(dispensas: Dispensa[], secao: Secao, item: number): boolean {
  return dispensas.some((d) => d.secao === secao && d.item === item);
}

export interface ConclusaoRecalc {
  conformes: number;
  naoConformes: number;
  atencao: number;
  dispensados: number;
  decisao: DecisaoGeral;
}

/** Recalcula totais e decisão considerando as dispensas (itens NÃO CONFORME dispensados
 *  saem da contagem de pendências). */
export function recomputeConclusao(analysis: AnalysisResult, dispensas: Dispensa[]): ConclusaoRecalc {
  let conformes = 0, naoConformes = 0, atencao = 0, dispensados = 0;

  const conta = (secao: Secao, items: Array<{ item: number; status: string }>) => {
    for (const it of items) {
      if (it.status === 'NAO_CONFORME' && isDispensado(dispensas, secao, it.item)) {
        dispensados++;
        continue;
      }
      if (it.status === 'CONFORME') conformes++;
      else if (it.status === 'NAO_CONFORME') naoConformes++;
      else atencao++;
    }
  };

  conta('reg', analysis.regularidade_fiscal_trabalhista);
  conta('inst', analysis.instrucao_processual);

  const decisao: DecisaoGeral = naoConformes === 0 ? 'CONFORME' : 'NAO_CONFORME';
  return { conformes, naoConformes, atencao, dispensados, decisao };
}
```

- [ ] **Passo 4: Rodar (passa):** `npm run test -- dispensation` → PASS (4 testes)

- [ ] **Passo 5: Commit**

```bash
git add src/lib/dispensation.ts tests/unit/dispensation.test.ts
git commit -m "feat: funcoes puras de dispensa (isDispensado, recomputeConclusao)"
```

---

## Tarefa 2: Relatório PDF com dispensas (`report-generator.tsx`)

**Arquivos:** Modificar `src/lib/report-generator.tsx`

- [ ] **Passo 1: Adicionar imports e estilos**

No topo, após o import de tipos:

```typescript
import type { AnalysisResult, ChecklistItemStatus } from '@/lib/types';
import { recomputeConclusao, isDispensado, type Dispensa, type Secao } from '@/lib/dispensation';
```

- [ ] **Passo 2: `ChecklistSection` recebe `secao` e `dispensas`** e marca dispensados

Substituir a função `ChecklistSection` inteira por:

```typescript
function ChecklistSection({
  title,
  secao,
  items,
  dispensas,
}: {
  title: string;
  secao: Secao;
  items: Array<{ item: number; descricao: string; status: ChecklistItemStatus; motivo: string | null; sugestao_correcao: string | null; data_validade?: string | null }>;
  dispensas: Dispensa[];
}) {
  return (
    <View>
      <Text style={s.sectionTitle}>{title}</Text>
      {items.map((it) => {
        const disp = dispensas.find((d) => d.secao === secao && d.item === it.item && it.status === 'NAO_CONFORME');
        return (
          <View key={it.item} style={s.checklistRow}>
            <Text style={s.checklistNum}>{it.item}.</Text>
            <View style={s.checklistDesc}>
              <Text>{it.descricao}</Text>
              {it.data_validade && (
                <Text style={{ color: '#1e3a5f', fontSize: 8, marginTop: 1, fontWeight: 'bold' }}>Válido até: {it.data_validade}</Text>
              )}
              {disp ? (
                <Text style={{ color: '#1e3a5f', fontSize: 8, marginTop: 1 }}>
                  Dispensado por {disp.auditorNome || 'auditor'}{disp.dataISO ? ` em ${new Date(disp.dataISO).toLocaleDateString('pt-BR')}` : ''} — {disp.justificativa}
                </Text>
              ) : (
                <>
                  {it.motivo && <Text style={{ color: '#666', fontSize: 8, marginTop: 1 }}>{it.motivo}</Text>}
                  {it.sugestao_correcao && <Text style={{ color: '#c2410c', fontSize: 8, marginTop: 1 }}>► {it.sugestao_correcao}</Text>}
                </>
              )}
            </View>
            <Text style={[s.statusBadge, { backgroundColor: disp ? '#1e3a5f' : STATUS_COLOR[it.status] }]}>
              {disp ? 'DISPENSADO' : STATUS_LABEL[it.status]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
```

- [ ] **Passo 3: `ConformityDocument` usa recálculo + seção de exceções**

Substituir a função `ConformityDocument` inteira por:

```typescript
function ConformityDocument({ analysis, dispensas }: { analysis: AnalysisResult; dispensas: Dispensa[] }) {
  const { identificacao_contrato: id, regularidade_fiscal_trabalhista: reg, instrucao_processual: inst, conclusao } = analysis;
  const recalc = recomputeConclusao(analysis, dispensas);
  const decisaoColor = DECISAO_COLOR[recalc.decisao] ?? '#555';

  return (
    <Document title="Relatório de Conformidade — EMSERH" author="GCIF/EMSERH">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>RELATÓRIO DE CONFORMIDADE</Text>
          <Text style={s.subtitle}>EMSERH — Empresa Maranhense de Serviços Hospitalares | GCIF — Gerência de Controle Interno Financeiro</Text>
        </View>

        <Text style={s.sectionTitle}>1. IDENTIFICAÇÃO DO PROCESSO</Text>
        {[
          ['Credor', id.credor], ['CNPJ', id.cnpj], ['Contrato', id.contrato_numero], ['Objeto', id.objeto],
          ['Período', id.periodo_referencia], ['Processo SEI', id.processo_sei], ['Valor Total', id.valor_total],
        ].map(([label, value]) => (
          <View key={label} style={s.row}><Text style={s.label}>{label}:</Text><Text style={s.value}>{value}</Text></View>
        ))}

        <ChecklistSection title="2. REGULARIDADE FISCAL E TRABALHISTA (Itens 1–7)" secao="reg" items={reg} dispensas={dispensas} />
        <ChecklistSection title="3. INSTRUÇÃO PROCESSUAL (Itens 8–15)" secao="inst" items={inst} dispensas={dispensas} />

        <View style={[s.conclusaoBox, { borderColor: decisaoColor }]}>
          <Text style={[s.decisaoText, { color: decisaoColor }]}>DECISÃO: {recalc.decisao.replace('_', ' ')}</Text>
          <Text style={s.resumo}>{conclusao.resumo}</Text>
          <View style={s.totaisRow}>
            <View style={[s.totaisBox, { backgroundColor: '#16a34a' }]}><Text style={s.totaisNum}>{recalc.conformes}</Text><Text style={s.totaisLabel}>Conformes</Text></View>
            <View style={[s.totaisBox, { backgroundColor: '#dc2626' }]}><Text style={s.totaisNum}>{recalc.naoConformes}</Text><Text style={s.totaisLabel}>Não Conformes</Text></View>
            <View style={[s.totaisBox, { backgroundColor: '#d97706' }]}><Text style={s.totaisNum}>{recalc.atencao}</Text><Text style={s.totaisLabel}>Atenção</Text></View>
            <View style={[s.totaisBox, { backgroundColor: '#1e3a5f' }]}><Text style={s.totaisNum}>{recalc.dispensados}</Text><Text style={s.totaisLabel}>Dispensados</Text></View>
          </View>
        </View>

        {dispensas.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>4. EXCEÇÕES APLICADAS NESTA ANÁLISE</Text>
            {dispensas.map((d, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 8.5, color: '#1e3a5f', fontWeight: 'bold' }}>
                  {d.secao === 'reg' ? 'Regularidade' : 'Instrução'} — item {d.item} · dispensado por {d.auditorNome || 'auditor'}{d.dataISO ? ` em ${new Date(d.dataISO).toLocaleDateString('pt-BR')}` : ''}
                </Text>
                <Text style={{ fontSize: 8, color: '#333' }}>Justificativa: {d.justificativa}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Documento gerado automaticamente pelo Sistema de Auditoria EMSERH — GCIF | Base legal: Lei 13.303/2016, Portaria 439/2024-GAB/EMSERH, Portaria 279/2025-GAB/EMSERH</Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Passo 4: `generateConformityReport` aceita dispensas opcionais**

Substituir a função final por:

```typescript
export async function generateConformityReport(analysis: AnalysisResult, dispensas: Dispensa[] = []): Promise<Buffer> {
  const uint8 = await renderToBuffer(<ConformityDocument analysis={analysis} dispensas={dispensas} />);
  return Buffer.from(uint8);
}
```

- [ ] **Passo 5: Verificar build:** `npm run build` → PASS

- [ ] **Passo 6: Commit**

```bash
git add src/lib/report-generator.tsx
git commit -m "feat: relatorio PDF registra itens dispensados + secao de excecoes"
```

---

## Tarefa 3: Endpoint de regeneração (`/api/report`)

**Arquivos:** Criar `src/app/api/report/route.ts`

- [ ] **Passo 1: Implementar**

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AnalysisResultSchema } from '@/lib/types';
import { generateConformityReport } from '@/lib/report-generator';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const DispensaSchema = z.object({
  secao: z.enum(['reg', 'inst']),
  item: z.number().int(),
  justificativa: z.string().min(1),
  auditorNome: z.string(),
  dataISO: z.string(),
});

const BodySchema = z.object({
  analysis: AnalysisResultSchema,
  dispensas: z.array(DispensaSchema),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
  try {
    const pdf = await generateConformityReport(parsed.data.analysis, parsed.data.dispensas);
    return NextResponse.json({ reportPdf: pdf.toString('base64') });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'report_regen_failed');
    return NextResponse.json({ error: 'Falha ao gerar o relatório' }, { status: 500 });
  }
}
```

- [ ] **Passo 2: Verificar build:** `npm run build` → PASS; rota `/api/report` listada

- [ ] **Passo 3: Commit**

```bash
git add src/app/api/report/route.ts
git commit -m "feat: endpoint /api/report regenera relatorio com dispensas"
```

---

## Tarefa 4: UI de dispensa no `ResultPanel`

**Arquivos:** Modificar `src/components/ResultPanel.tsx`, `src/app/globals.css`

- [ ] **Passo 1: Reescrever `src/components/ResultPanel.tsx`**

```typescript
'use client';

import { useEffect, useState } from 'react';
import type { AnalysisResult, ChecklistItemStatus, RegularidadeItem, InstrucaoItem } from '@/lib/types';
import { recomputeConclusao, isDispensado, type Dispensa, type Secao } from '@/lib/dispensation';

function downloadBase64(base64: string, filename: string) {
  const link = document.createElement('a');
  link.href = `data:application/pdf;base64,${base64}`;
  link.download = filename;
  link.click();
}

function dotClass(status: ChecklistItemStatus): string {
  if (status === 'CONFORME') return 'ok';
  if (status === 'NAO_CONFORME') return 'err';
  return 'warn';
}

function SectionHeader({ title }: { title: string }) {
  return <div className="findings-section-header">{title}</div>;
}

interface FindingRowProps {
  item: RegularidadeItem | InstrucaoItem;
  secao: Secao;
  dataValidade?: string | null;
  dispensas: Dispensa[];
  onDispensar: (secao: Secao, item: number, justificativa: string) => void;
  onDesfazer: (secao: Secao, item: number) => void;
}

function FindingRow({ item, secao, dataValidade, dispensas, onDispensar, onDesfazer }: FindingRowProps) {
  const [aberto, setAberto] = useState(false);
  const [just, setJust] = useState('');
  const disp = dispensas.find((d) => d.secao === secao && d.item === item.item);
  const podeDispensar = item.status === 'NAO_CONFORME';

  return (
    <div className="finding">
      <div className={`finding-dot ${disp ? 'disp' : dotClass(item.status)}`} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="finding-header">
          <div className="finding-title">{item.descricao}</div>
          {disp && <span className="finding-disp-badge">DISPENSADO</span>}
          {item.documento_verificador && <span className="finding-ref">{item.documento_verificador}</span>}
        </div>
        {dataValidade && <p className="finding-validade">Válido até: <strong>{dataValidade}</strong></p>}
        {disp ? (
          <p className="finding-desc" style={{ color: 'var(--emserh-navy)' }}>
            Dispensado — {disp.justificativa}{' '}
            <button className="finding-undo" onClick={() => onDesfazer(secao, item.item)}>desfazer</button>
          </p>
        ) : (
          <>
            {item.motivo && <p className="finding-desc">{item.motivo}</p>}
            {item.sugestao_correcao && <p className="finding-desc" style={{ color: 'var(--warn)', marginTop: 4 }}>► {item.sugestao_correcao}</p>}
            {podeDispensar && !aberto && (
              <button className="finding-dispensar" onClick={() => setAberto(true)}>Dispensar (não se aplica)</button>
            )}
            {podeDispensar && aberto && (
              <div className="dispensar-box">
                <textarea className="dispensar-input" placeholder="Justificativa (obrigatória)" value={just} onChange={(e) => setJust(e.target.value)} />
                <div className="dispensar-actions">
                  <button className="dispensar-cancel" onClick={() => { setAberto(false); setJust(''); }}>Cancelar</button>
                  <button className="dispensar-ok" disabled={just.trim().length === 0} onClick={() => { onDispensar(secao, item.item, just.trim()); setAberto(false); setJust(''); }}>Confirmar dispensa</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ResultPanelProps {
  filename: string;
  analysis: AnalysisResult;
  reportPdfBase64: string;
  annotatedPdfBase64: string;
}

export function ResultPanel({ filename, analysis, reportPdfBase64, annotatedPdfBase64 }: ResultPanelProps) {
  const { identificacao_contrato: id, conclusao } = analysis;
  const [dispensas, setDispensas] = useState<Dispensa[]>([]);
  const [auditorNome, setAuditorNome] = useState('');
  const [gerando, setGerando] = useState(false);
  const [erroPdf, setErroPdf] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => setAuditorNome(d?.user?.nome ?? '')).catch(() => {});
  }, []);

  const recalc = recomputeConclusao(analysis, dispensas);

  function dispensar(secao: Secao, item: number, justificativa: string) {
    setDispensas((prev) => [...prev, { secao, item, justificativa, auditorNome, dataISO: new Date().toISOString() }]);
  }
  function desfazer(secao: Secao, item: number) {
    setDispensas((prev) => prev.filter((d) => !(d.secao === secao && d.item === item)));
  }

  async function baixarRelatorio() {
    if (dispensas.length === 0) {
      downloadBase64(reportPdfBase64, `relatorio-conformidade-${filename}`);
      return;
    }
    setGerando(true); setErroPdf(null);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis, dispensas }),
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

  return (
    <div className="card">
      <div style={{ background: 'var(--emserh-navy)', padding: '18px 22px' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 600 }}>Resultado da Análise</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</div>
      </div>

      <div className="card-body" style={{ paddingTop: 18 }}>
        <div className="contract-id">
          <dl className="contract-id-grid">
            <dt>Credor</dt><dd title={id.credor}>{id.credor}</dd>
            <dt>CNPJ</dt><dd>{id.cnpj}</dd>
            <dt>Contrato</dt><dd>{id.contrato_numero}</dd>
            <dt>Período</dt><dd>{id.periodo_referencia}</dd>
            <dt>Processo SEI</dt><dd>{id.processo_sei}</dd>
            <dt>Valor Total</dt><dd>{id.valor_total}</dd>
          </dl>
        </div>

        <div className="results-summary">
          <div className="stat ok"><div className="lbl">Conformes</div><div className="val">{recalc.conformes}</div></div>
          <div className="stat warn"><div className="lbl">Atenção</div><div className="val">{recalc.atencao}</div></div>
          <div className="stat err"><div className="lbl">Não Conformes</div><div className="val">{recalc.naoConformes}</div></div>
          {recalc.dispensados > 0 && <div className="stat disp"><div className="lbl">Dispensados</div><div className="val">{recalc.dispensados}</div></div>}
        </div>

        {conclusao.resumo && <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 18 }}>{conclusao.resumo}</p>}

        <div className="findings">
          <SectionHeader title="Regularidade Fiscal e Trabalhista" />
          {analysis.regularidade_fiscal_trabalhista.map((it) => (
            <FindingRow key={`reg-${it.item}`} item={it} secao="reg" dataValidade={it.data_validade} dispensas={dispensas} onDispensar={dispensar} onDesfazer={desfazer} />
          ))}
          <SectionHeader title="Instrução Processual" />
          {analysis.instrucao_processual.map((it) => (
            <FindingRow key={`inst-${it.item}`} item={it} secao="inst" dispensas={dispensas} onDispensar={dispensar} onDesfazer={desfazer} />
          ))}
        </div>

        {erroPdf && <p className="admin-error" style={{ marginTop: 12 }}>{erroPdf}</p>}

        <div className="download-row">
          <button className="btn-dl-primary" onClick={baixarRelatorio} disabled={gerando}>
            ↓ {gerando ? 'Gerando...' : 'Relatório de Conformidade'}
          </button>
          <button className="btn-dl-secondary" onClick={() => downloadBase64(annotatedPdfBase64, `processo-anotado-${filename}`)}>
            ↓ PDF Anotado
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Passo 2: Estilos em `src/app/globals.css`** (antes de `/* ===== Segment selector ===== */`)

```css
  /* ===== Dispensa de item ===== */
  .finding-dot.disp { background: var(--emserh-navy); }
  .finding-disp-badge { font-size: 9.5px; font-weight: 700; background: var(--emserh-navy); color: #fff; padding: 2px 7px; border-radius: 999px; letter-spacing: 0.04em; flex-shrink: 0; }
  .stat.disp .val { color: var(--emserh-navy); }
  .finding-dispensar { margin-top: 6px; background: none; border: 1px solid var(--em-border); color: var(--emserh-navy); font-size: 11.5px; font-weight: 600; padding: 5px 10px; border-radius: 7px; cursor: pointer; font-family: inherit; }
  .finding-dispensar:hover { background: rgba(10,35,81,0.05); }
  .finding-undo { background: none; border: 0; color: var(--em-muted); font-size: 11px; text-decoration: underline; cursor: pointer; padding: 0; }
  .dispensar-box { margin-top: 8px; }
  .dispensar-input { width: 100%; min-height: 52px; border: 1px solid var(--em-border); border-radius: 8px; padding: 8px 10px; font-size: 12.5px; font-family: var(--font-sans); color: var(--ink-2); resize: vertical; }
  .dispensar-input:focus { outline: none; border-color: var(--emserh-navy); box-shadow: 0 0 0 3px rgba(10,35,81,0.08); }
  .dispensar-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
  .dispensar-cancel { background: none; border: 1px solid var(--line); color: var(--ink-2); font-size: 12px; font-weight: 500; padding: 6px 12px; border-radius: 7px; cursor: pointer; font-family: inherit; }
  .dispensar-ok { background: var(--emserh-navy); border: 0; color: #fff; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 7px; cursor: pointer; font-family: inherit; }
  .dispensar-ok:disabled { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Passo 3: Verificar build:** `npm run build` → PASS

- [ ] **Passo 4: Commit**

```bash
git add src/components/ResultPanel.tsx src/app/globals.css
git commit -m "feat: UI de dispensa de item no resultado (recalculo ao vivo + regeneracao do PDF)"
```

---

## Tarefa 5: Verificação final + push

- [ ] **Passo 1:** `npm run build` → PASS
- [ ] **Passo 2:** `npm run test` → PASS (todos, incluindo dispensation)
- [ ] **Passo 3:** `git push`

---

## Auto-revisão

**Cobertura do spec:** dispensar item NÃO CONFORME (T4) ✅ · justificativa obrigatória (T4, botão desabilitado) ✅ · recálculo ao vivo (T1+T4) ✅ · PDF com DISPENSADO + seção de exceções + decisão recalculada (T2) ✅ · regeneração no download (T3+T4) ✅ · desfazer dispensa (T4) ✅ · sem persistência ✅

**Consistência de tipos:** `Dispensa {secao,item,justificativa,auditorNome,dataISO}` e `Secao` definidos em T1, usados em T2/T3/T4 ✅ · `recomputeConclusao`/`isDispensado` T1 usados em T2/T4 ✅ · `generateConformityReport(analysis, dispensas?)` T2 chamado em T3 ✅ · `/api/report` body `{analysis, dispensas}` T3 = payload do ResultPanel T4 ✅
