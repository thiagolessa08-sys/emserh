import { z } from 'zod';

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
  item: z.number().int().min(1),
  descricao: z.string(),
  status: ChecklistItemStatus,
  motivo: z.string().nullable(),
  documento_verificador: z.string().nullable(),
  citacao: z.string(),
  pagina_estimada: z.number().int().min(1),
  observacoes: z.string(),
  sugestao_correcao: z.string().nullable(),
});

export const RegularidadeItemSchema = ChecklistItemBaseSchema.extend({
  data_validade: z.string().nullable(),
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
  regularidade_fiscal_trabalhista: z.array(RegularidadeItemSchema).length(7),
  instrucao_processual: z.array(InstrucaoItemSchema).length(8),
  conclusao: ConclusaoSchema,
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
