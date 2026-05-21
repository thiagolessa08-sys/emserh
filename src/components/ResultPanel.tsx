'use client';

import type { AnalysisResult, ChecklistItemStatus } from '@/lib/types';

const STATUS_LABEL: Record<ChecklistItemStatus, string> = {
  CONFORME: 'CONFORME',
  NAO_CONFORME: 'NÃO CONFORME',
  ATENCAO: 'ATENÇÃO',
};

const STATUS_CLASS: Record<ChecklistItemStatus, string> = {
  CONFORME: 'bg-green-100 text-green-800',
  NAO_CONFORME: 'bg-red-100 text-red-800',
  ATENCAO: 'bg-yellow-100 text-yellow-800',
};

const DECISAO_CLASS: Record<string, string> = {
  CONFORME: 'border-green-500 bg-green-50 text-green-800',
  NAO_CONFORME: 'border-red-500 bg-red-50 text-red-800',
  PENDENTE_AJUSTES: 'border-yellow-500 bg-yellow-50 text-yellow-800',
};

function StatusBadge({ status }: { status: ChecklistItemStatus }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

interface ChecklistTableProps {
  title: string;
  items: Array<{
    item: number;
    descricao: string;
    status: ChecklistItemStatus;
    motivo: string | null;
    sugestao_correcao: string | null;
  }>;
}

function ChecklistTable({ title, items }: ChecklistTableProps) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
        {items.map((it) => (
          <div key={it.item} className="flex items-start gap-3 px-4 py-3">
            <span className="w-6 shrink-0 text-sm text-gray-400 pt-0.5">{it.item}.</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800">{it.descricao}</p>
              {it.motivo && <p className="mt-0.5 text-xs text-gray-500">{it.motivo}</p>}
              {it.sugestao_correcao && (
                <p className="mt-1 text-xs text-orange-700">► {it.sugestao_correcao}</p>
              )}
            </div>
            <StatusBadge status={it.status} />
          </div>
        ))}
      </div>
    </section>
  );
}

interface ResultPanelProps {
  filename: string;
  analysis: AnalysisResult;
  reportPdfBase64: string;
  annotatedPdfBase64: string;
}

function downloadBase64(base64: string, filename: string) {
  const link = document.createElement('a');
  link.href = `data:application/pdf;base64,${base64}`;
  link.download = filename;
  link.click();
}

export function ResultPanel({ filename, analysis, reportPdfBase64, annotatedPdfBase64 }: ResultPanelProps) {
  const { identificacao_contrato: id, conclusao } = analysis;
  const decisaoClass = DECISAO_CLASS[conclusao.decisao_geral] ?? 'border-gray-300 bg-gray-50';
  const decisaoLabel = conclusao.decisao_geral.replace('_', ' ');

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Cabeçalho */}
      <div className="bg-[#1e3a5f] px-6 py-4 text-white">
        <p className="text-xs uppercase tracking-wider opacity-70">Resultado da Análise</p>
        <h2 className="mt-1 text-lg font-bold truncate">{filename}</h2>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Identificação */}
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Identificação do Processo
          </h3>
          <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {[
              ['Credor', id.credor],
              ['CNPJ', id.cnpj],
              ['Contrato', id.contrato_numero],
              ['Período', id.periodo_referencia],
              ['Processo SEI', id.processo_sei],
              ['Valor Total', id.valor_total],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-1">
                <dt className="shrink-0 font-medium text-gray-500">{label}:</dt>
                <dd className="text-gray-800 truncate">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Conclusão */}
        <div className={`rounded-lg border-2 px-4 py-3 ${decisaoClass}`}>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Decisão Final</p>
          <p className="mt-1 text-xl font-bold">{decisaoLabel}</p>
          <p className="mt-1 text-sm">{conclusao.resumo}</p>
          <div className="mt-3 flex gap-4 text-sm">
            <span className="font-medium text-green-700">{conclusao.total_itens_conformes} Conformes</span>
            <span className="font-medium text-red-700">{conclusao.total_itens_nao_conformes} Não Conformes</span>
            <span className="font-medium text-yellow-700">{conclusao.total_itens_atencao} Atenção</span>
          </div>
          {conclusao.lista_pendencias.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {conclusao.lista_pendencias.map((p, i) => (
                <li key={i} className="text-xs">• {p}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Checklists */}
        <ChecklistTable
          title="Regularidade Fiscal e Trabalhista (Itens 1–7)"
          items={analysis.regularidade_fiscal_trabalhista}
        />
        <ChecklistTable
          title="Instrução Processual (Itens 8–15)"
          items={analysis.instrucao_processual}
        />

        {/* Downloads */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={() =>
              downloadBase64(reportPdfBase64, `relatorio-conformidade-${filename}`)
            }
            className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#162d4a] transition-colors"
          >
            ⬇ Baixar Relatório de Conformidade
          </button>
          <button
            onClick={() =>
              downloadBase64(annotatedPdfBase64, `processo-anotado-${filename}`)
            }
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ⬇ Baixar PDF Anotado
          </button>
        </div>
      </div>
    </div>
  );
}
