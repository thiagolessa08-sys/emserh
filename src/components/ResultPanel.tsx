'use client';

import type { AnalysisResult, ChecklistItemStatus, RegularidadeItem, InstrucaoItem } from '@/lib/types';

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
  return (
    <div className="findings-section-header">
      {title}
    </div>
  );
}

function FindingRow({ item, dataValidade }: { item: RegularidadeItem | InstrucaoItem; dataValidade?: string | null }) {
  return (
    <div className="finding">
      <div className={`finding-dot ${dotClass(item.status)}`} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="finding-header">
          <div className="finding-title">{item.descricao}</div>
          {item.documento_verificador && (
            <span className="finding-ref">{item.documento_verificador}</span>
          )}
        </div>
        {dataValidade && (
          <p className="finding-validade">
            Válido até: <strong>{dataValidade}</strong>
          </p>
        )}
        {item.motivo && <p className="finding-desc">{item.motivo}</p>}
        {item.sugestao_correcao && (
          <p className="finding-desc" style={{ color: 'var(--warn)', marginTop: '4px' }}>
            ► {item.sugestao_correcao}
          </p>
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

export function ResultPanel({
  filename,
  analysis,
  reportPdfBase64,
  annotatedPdfBase64,
}: ResultPanelProps) {
  const { identificacao_contrato: id, conclusao } = analysis;

  return (
    <div className="card">
      {/* Header band */}
      <div style={{ background: 'var(--emserh-navy)', padding: '18px 22px' }}>
        <div
          style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.55)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '4px',
            fontWeight: 600,
          }}
        >
          Resultado da Análise
        </div>
        <div
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'white',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {filename}
        </div>
      </div>

      <div className="card-body" style={{ paddingTop: '18px' }}>
        {/* Identificação */}
        <div className="contract-id">
          <dl className="contract-id-grid">
            <dt>Credor</dt>
            <dd title={id.credor}>{id.credor}</dd>
            <dt>CNPJ</dt>
            <dd>{id.cnpj}</dd>
            <dt>Contrato</dt>
            <dd>{id.contrato_numero}</dd>
            <dt>Período</dt>
            <dd>{id.periodo_referencia}</dd>
            <dt>Processo SEI</dt>
            <dd>{id.processo_sei}</dd>
            <dt>Valor Total</dt>
            <dd>{id.valor_total}</dd>
          </dl>
        </div>

        {/* Estatísticas */}
        <div className="results-summary">
          <div className="stat ok">
            <div className="lbl">Conformes</div>
            <div className="val">{conclusao.total_itens_conformes}</div>
          </div>
          <div className="stat warn">
            <div className="lbl">Atenção</div>
            <div className="val">{conclusao.total_itens_atencao}</div>
          </div>
          <div className="stat err">
            <div className="lbl">Não Conformes</div>
            <div className="val">{conclusao.total_itens_nao_conformes}</div>
          </div>
        </div>

        {/* Resumo */}
        {conclusao.resumo && (
          <p style={{ fontSize: '13.5px', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: '18px' }}>
            {conclusao.resumo}
          </p>
        )}

        {/* Regularidade fiscal / trabalhista */}
        <div className="findings">
          <SectionHeader title="Regularidade Fiscal e Trabalhista" />
          {analysis.regularidade_fiscal_trabalhista.map((item) => (
            <FindingRow key={item.item} item={item} dataValidade={item.data_validade} />
          ))}

          <SectionHeader title="Instrução Processual" />
          {analysis.instrucao_processual.map((item) => (
            <FindingRow key={item.item} item={item} />
          ))}
        </div>

        {/* Downloads */}
        <div className="download-row">
          <button
            className="btn-dl-primary"
            onClick={() => downloadBase64(reportPdfBase64, `relatorio-conformidade-${filename}`)}
          >
            ↓ Relatório de Conformidade
          </button>
          <button
            className="btn-dl-secondary"
            onClick={() => downloadBase64(annotatedPdfBase64, `processo-anotado-${filename}`)}
          >
            ↓ PDF Anotado
          </button>
        </div>
      </div>
    </div>
  );
}
