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
