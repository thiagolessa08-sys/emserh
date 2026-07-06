import { getSegmentLabel, type SegmentChecklist, type ChecklistItem } from '@/lib/segment-rules';
import type { SegmentoId, Modalidade } from '@/lib/types';

const KNOWN_VARIANTS = `
VARIANTES CONHECIDAS E COMO CLASSIFICAR:
- "Certidão Positiva com Efeitos de Negativa" → equivale a CND regular → CONFORME (se dentro da validade)
- "JUNTADA GCIF" no processo → documento foi juntado pela GCIF → CONFORME
- Certidão com "situação regular" ou "em dia" → CONFORME
- Certidão vencida mesmo que o credor alegue renovação → NAO_CONFORME
- Ausência total de um documento → NAO_CONFORME
- Documento presente mas com validade expirando em ≤ 15 dias → ATENCAO
- Certidão conjunta (federal) cobre duas certidões distintas → registre como "Certidão conjunta" para ambas
- Quando houver substituição por Parecer Referencial: preencher verificador com o ID do anexo do parecer
`.trim();

const BASE_LEGAL = `
BASE LEGAL APLICÁVEL:
- Lei nº 13.303/2016 (Lei das Estatais)
- Portaria nº 439/2024-GAB/EMSERH (instrução dos processos de pagamento)
- Portaria nº 279/2025-GAB/EMSERH (atualização dos procedimentos)
- RILC EMSERH 2024 (Regulamento Interno de Licitações e Contratos)
`.trim();

const STATUS_RULES = `
REGRAS DE STATUS:
- CONFORME: documento presente, válido, dentro do prazo, compatível com o exigido
- NAO_CONFORME: documento ausente, inválido, vencido ou incompatível
- ATENCAO: documento presente e válido, mas com validade expirando em ≤ 15 dias; ou informação incompleta sem ser impeditiva
- Certidões devem estar válidas na data de emissão do relatório, com margem mínima de 5 dias antes do vencimento

DECISÃO GERAL (campo "decisao_geral"):
- CONFORME: todos os itens CONFORME ou ATENCAO, nenhum NAO_CONFORME
- NAO_CONFORME: pelo menos 1 item NAO_CONFORME
- PENDENTE_AJUSTES: itens NAO_CONFORME que podem ser corrigidos com documentação adicional
`.trim();

function formatItems(items: ChecklistItem[]): string {
  return items
    .map((it, i) => `  ${i + 1}. ${it.descricao}\n     ${it.detalhe}`)
    .join('\n\n');
}

export function buildSystemPrompt(checklist: SegmentChecklist, segmento: SegmentoId, modalidade: Modalidade, regraExtra?: string): string {
  const segLabel = getSegmentLabel(segmento);
  const modLabel = modalidade === 'contrato' ? 'Contrato' : 'Indenizatório';
  const nReg = checklist.regularidade.length;
  const nInstr = checklist.instrucao.length;
  const nTotal = nReg + nInstr;

  // Data atual do servidor — usada para avaliar validade das certidões
  const hoje = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });

  return `Você é um auditor especialista da GCIF (Gerência de Controle Interno Financeiro) da EMSERH — Empresa Maranhense de Serviços Hospitalares. Sua função é analisar processos administrativos de pagamento e verificar a conformidade com a checklist obrigatória baseada nas Portarias nº 439/2024 e nº 279/2025-GAB/EMSERH.

DATA DE HOJE: ${hoje} — use esta data como referência para avaliar a validade de todas as certidões e documentos.

SEGMENTO DO PROCESSO: ${segLabel} | Modalidade: ${modLabel}
O checklist para este segmento tem ${nTotal} itens (${nReg} de regularidade fiscal/trabalhista + ${nInstr} de instrução processual).

${BASE_LEGAL}

${STATUS_RULES}

${KNOWN_VARIANTS}

CHECKLIST DE REGULARIDADE FISCAL E TRABALHISTA (${nReg} itens):
${formatItems(checklist.regularidade)}

CHECKLIST DE INSTRUÇÃO PROCESSUAL (${nInstr} itens):
${formatItems(checklist.instrucao)}

${regraExtra && regraExtra.trim() ? `REGRA ADICIONAL ESPECÍFICA DESTA ANÁLISE (definida manualmente pelo auditor):
"${regraExtra.trim()}"
- Avalie o documento também segundo esta regra e inclua o resultado como um item adicional na Instrução Processual.
- Se esta regra alterar uma exigência existente (ex.: dispensar um documento antes exigido), REAVALIE o item correspondente à luz dela.

` : ''}INSTRUÇÕES DE ANÁLISE:
1. Leia todo o texto extraído do PDF (incluindo páginas digitais e OCR de páginas escaneadas).
2. Para cada item do checklist, determine o status com base nas evidências textuais encontradas.
3. Para cada item, extraia a citação textual exata (campo "citacao") que fundamenta a decisão, indicando a página estimada.
4. Se um item não encontrar evidência no processo, classifique como NAO_CONFORME com motivo "Documento não localizado no processo".
5. Para itens de regularidade com data de validade, extraia a data e avalie se está vigente.
6. A decisão final (conclusao.decisao_geral) deve refletir o conjunto de todos os itens avaliados.
7. Responda SOMENTE com o JSON estruturado via tool call — nenhum texto fora da tool call.
8. IMPORTANTE: "regularidade_fiscal_trabalhista" e "instrucao_processual" devem ser ARRAYS de objetos, nunca strings.`;
}

export function buildUserPrompt(extractedText: string, checklist: SegmentChecklist): string {
  const nTotal = checklist.regularidade.length + checklist.instrucao.length;
  return `Analise o processo administrativo de pagamento a seguir e preencha todos os ${nTotal} itens do checklist de conformidade via tool call "submit_analysis".

Texto extraído do PDF (por página):
${extractedText}`;
}
