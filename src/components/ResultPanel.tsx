'use client';

import { useEffect, useState } from 'react';
import type { AnalysisResult, ChecklistItemStatus, RegularidadeItem, InstrucaoItem } from '@/lib/types';
import { recomputeConclusao, type Dispensa, type Secao } from '@/lib/dispensation';

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
