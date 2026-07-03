'use client';

import { useState } from 'react';
import { SEGMENTOS, type SegmentoId, type Modalidade } from '@/lib/types';
import type { RulesStore, SegmentChecklist } from '@/lib/default-rules';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function emptyChecklist(): SegmentChecklist {
  return { regularidade: [], instrucao: [] };
}

export function RulesEditor({ initialStore, persistent = true }: { initialStore: RulesStore; persistent?: boolean }) {
  const [store, setStore] = useState<RulesStore>(initialStore);
  const [segmento, setSegmento] = useState<SegmentoId>(SEGMENTOS[0].id);
  const segConfig = SEGMENTOS.find((s) => s.id === segmento)!;
  const modalidadesDoSegmento = segConfig.modalidades as ReadonlyArray<string>;
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
    const modalidadesDisponiveis = cfg.modalidades as ReadonlyArray<string>;
    const novaMod = (modalidadesDisponiveis.includes(modalidade) ? modalidade : cfg.modalidades[0]) as Modalidade;
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
      {!persistent && (
        <div className="admin-warning">
          ⚠️ <strong>Persistência não configurada.</strong> As edições feitas aqui serão perdidas no próximo deploy.
          Configure um volume montado em <code>/data</code> e a variável <code>RULES_STORE_PATH=/data/rules.json</code> no Railway.
        </div>
      )}
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
                {modalidadesDoSegmento.includes('contrato') && <option value="contrato">Contrato</option>}
                {modalidadesDoSegmento.includes('indenizatorio') && <option value="indenizatorio">Indenizatório</option>}
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
