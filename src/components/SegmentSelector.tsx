'use client';

import { SEGMENTOS, type SegmentoId, type Modalidade } from '@/lib/types';

const DESCRICAO_SEGMENTO: Record<SegmentoId, string> = {
  fornecedor: 'Verifica Anexo I + II. Cobre materiais, serviços gerais, OPME, laboratório, alimentação e água mineral.',
  cessao_mao_obra: 'Verifica Anexo I + III. Exige comprovação de INSS, FGTS, salários nomeados, CCT vigente e CNDT.',
  engenharia: 'Verifica Anexo I + IV. Exige ART/CREA, laudos técnicos e boletins de medição por tipo de serviço.',
  servicos_medicos: 'Verifica Anexo I + V. Exige relação de honorários, QSA e relatório por tipo (plantão/ambulatório/cirurgia).',
  locacao_pf: 'Verifica Anexo VI Item 1 (sem Anexo I). Certidões em nome do proprietário pessoa física.',
  locacao_pj: 'Verifica Anexo I + Anexo VI Item 2. Exige Certidão Vintenária e IPTU.',
  monopolio: 'Verifica apenas Anexo I. Para concessionárias de serviços públicos (água, energia, telecomunicações) e locações em geral.',
};

interface SegmentSelectorProps {
  segmento: SegmentoId | '';
  modalidade: Modalidade;
  onChange: (segmento: SegmentoId | '', modalidade: Modalidade) => void;
}

export function SegmentSelector({ segmento, modalidade, onChange }: SegmentSelectorProps) {
  const segConfig = SEGMENTOS.find(s => s.id === segmento);
  const modalidadesDisponiveis: ReadonlyArray<string> = segConfig?.modalidades ?? ['contrato', 'indenizatorio'];

  function handleSegmento(e: React.ChangeEvent<HTMLSelectElement>) {
    const novoSegmento = e.target.value as SegmentoId | '';
    const config = SEGMENTOS.find(s => s.id === novoSegmento);
    const novaModalidade =
      config && !(config.modalidades as ReadonlyArray<string>).includes(modalidade)
        ? (config.modalidades[0] as Modalidade)
        : modalidade;
    onChange(novoSegmento, novaModalidade);
  }

  function handleModalidade(e: React.ChangeEvent<HTMLSelectElement>) {
    onChange(segmento, e.target.value as Modalidade);
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">Tipo do processo</div>
        <span style={{ fontSize: '11px', color: 'var(--em-muted)', fontWeight: 500 }}>
          Obrigatório antes do upload
        </span>
      </div>
      <div className="card-body">
        <div className="segment-row">
          <div className="segment-field">
            <label className="segment-label" htmlFor="sel-segmento">Segmento</label>
            <select
              id="sel-segmento"
              className="segment-select"
              value={segmento}
              onChange={handleSegmento}
            >
              <option value="">— Selecione —</option>
              {SEGMENTOS.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="segment-field">
            <label className="segment-label" htmlFor="sel-modalidade">Modalidade</label>
            <select
              id="sel-modalidade"
              className="segment-select"
              value={modalidade}
              onChange={handleModalidade}
              disabled={!segmento}
            >
              {modalidadesDisponiveis.includes('contrato') && (
                <option value="contrato">Contrato</option>
              )}
              {modalidadesDisponiveis.includes('indenizatorio') && (
                <option value="indenizatorio">Indenizatório</option>
              )}
            </select>
          </div>
        </div>

        {segmento && (
          <div className="segment-hint">
            <span className="segment-hint-icon">ℹ</span>
            <span>{DESCRICAO_SEGMENTO[segmento as SegmentoId]}</span>
            {segConfig && (
              <span className="segment-anexo-badge">{segConfig.anexos}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
