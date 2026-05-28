import { z } from 'zod';

export const SEGMENTOS = [
  { id: 'fornecedor',        label: 'Fornecedor (materiais / serviços)',      anexos: 'Anexo I + II',              modalidades: ['contrato', 'indenizatorio'] },
  { id: 'cessao_mao_obra',   label: 'Cessão de Mão de Obra (terceirização)',  anexos: 'Anexo I + III',             modalidades: ['contrato', 'indenizatorio'] },
  { id: 'engenharia',        label: 'Serviços de Engenharia',                  anexos: 'Anexo I + IV',              modalidades: ['contrato'] },
  { id: 'servicos_medicos',  label: 'Serviços Médicos',                        anexos: 'Anexo I + V',               modalidades: ['contrato', 'indenizatorio'] },
  { id: 'locacao_pf',        label: 'Locação de Imóvel — Pessoa Física',       anexos: 'Anexo VI Item 1',           modalidades: ['contrato'] },
  { id: 'locacao_pj',        label: 'Locação de Imóvel — Pessoa Jurídica',     anexos: 'Anexo I + Anexo VI Item 2', modalidades: ['contrato'] },
  { id: 'monopolio',         label: 'Monopólio / Locação em geral',            anexos: 'Apenas Anexo I',            modalidades: ['contrato'] },
] as const;

export type SegmentoId = typeof SEGMENTOS[number]['id'];
export type Modalidade = 'contrato' | 'indenizatorio';

export const ChecklistItemStatus = z.enum(['CONFORME', 'NAO_CONFORME', 'ATENCAO']);
export type ChecklistItemStatus = z.infer<typeof ChecklistItemStatus>;

export const DecisaoGeral = z.enum(['CONFORME', 'NAO_CONFORME', 'PENDENTE_AJUSTES']);
export type DecisaoGeral = z.infer<typeof DecisaoGeral>;

export const IdentificacaoContratoSchema = z.object({
  credor: z.string(),
  cnpj: z.string(),
  contrato_numero: z.string(),
  objeto: z.string(),
  periodo_referencia: z.string(),
  processo_sei: z.string(),
  valor_total: z.string(),
});
export type IdentificacaoContrato = z.infer<typeof IdentificacaoContratoSchema>;

const ChecklistItemBaseSchema = z.object({
  item: z.number().int(),
  descricao: z.string(),
  status: ChecklistItemStatus,
  motivo: z.string().nullable(),
  documento_verificador: z.string().nullable(),
  citacao: z.string(),
  // Claude às vezes devolve 0; normaliza para mínimo 1
  pagina_estimada: z.number().int().transform((n) => Math.max(1, n)),
  observacoes: z.string(),
  sugestao_correcao: z.string().nullable(),
});

export const RegularidadeItemSchema = ChecklistItemBaseSchema.extend({
  // nullish aceita string | null | undefined; undefined é normalizado para null
  // (proteção caso o Claude omita o campo — é tratado como "data não encontrada")
  data_validade: z.string().nullish().transform((v) => v ?? null),
});
export type RegularidadeItem = z.infer<typeof RegularidadeItemSchema>;

export const InstrucaoItemSchema = ChecklistItemBaseSchema;
export type InstrucaoItem = z.infer<typeof InstrucaoItemSchema>;

export const ConclusaoSchema = z.object({
  decisao_geral: DecisaoGeral,
  resumo: z.string(),
  total_itens_conformes: z.number().int().min(0).max(15),
  total_itens_nao_conformes: z.number().int().min(0).max(15),
  total_itens_atencao: z.number().int().min(0).max(15),
  lista_pendencias: z.array(z.string()),
});
export type Conclusao = z.infer<typeof ConclusaoSchema>;

export const AnalysisResultSchema = z.object({
  identificacao_contrato: IdentificacaoContratoSchema,
  regularidade_fiscal_trabalhista: z.array(RegularidadeItemSchema).min(1),
  instrucao_processual: z.array(InstrucaoItemSchema).min(1),
  conclusao: ConclusaoSchema,
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
