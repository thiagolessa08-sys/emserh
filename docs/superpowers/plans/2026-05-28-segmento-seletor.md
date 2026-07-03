# Seletor de Segmento + Regras por Anexo — Plano de Implementação

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: Use superpowers:executing-plans para implementar este plano tarefa por tarefa. Os passos usam sintaxe de checkbox (`- [ ]`) para rastreamento.

**Objetivo:** Adicionar seletor de segmento (7 categorias da Cartilha GCIF 2026) + modalidade (Contrato/Indenizatório) antes do upload, e fazer a IA usar o checklist correto do Anexo correspondente (Portaria 439 + 279) em vez do checklist genérico atual.

**Arquitetura:** Card `SegmentSelector` acima da dropzone alimenta estado `segmento + modalidade` em `page.tsx`. O FormData envia esses valores à rota `/api/analyze`. O `claude-analyzer.ts` monta o prompt dinamicamente via `segment-rules.ts`, que contém o mapeamento completo de itens por segmento.

**Tech Stack:** Next.js 15 App Router, TypeScript, Zod, Tailwind/CSS custom vars EMSERH, Claude claude-sonnet-4-6 tool use.

---

## Arquivos afetados

- Criar: `src/lib/segment-rules.ts`
- Modificar: `src/lib/types.ts`
- Modificar: `src/lib/prompt.ts`
- Modificar: `src/lib/claude-analyzer.ts`
- Modificar: `src/app/api/analyze/route.ts`
- Criar: `src/components/SegmentSelector.tsx`
- Modificar: `src/app/page.tsx`
- Modificar: `src/app/globals.css`

---

## Tarefa 1: Tipos — Segmento e Modalidade (`types.ts`)

**Arquivo:** `src/lib/types.ts`

- [ ] **Passo 1:** Adicionar os enums e atualizar o schema ao topo do arquivo

```typescript
// Adicionar ANTES dos schemas existentes:
export const SEGMENTOS = [
  { id: 'fornecedor',        label: 'Fornecedor (materiais / serviços)',      anexos: 'Anexo I + II',         modalidades: ['contrato', 'indenizatorio'] },
  { id: 'cessao_mao_obra',   label: 'Cessão de Mão de Obra (terceirização)',  anexos: 'Anexo I + III',        modalidades: ['contrato', 'indenizatorio'] },
  { id: 'engenharia',        label: 'Serviços de Engenharia',                  anexos: 'Anexo I + IV',         modalidades: ['contrato'] },
  { id: 'servicos_medicos',  label: 'Serviços Médicos',                        anexos: 'Anexo I + V',          modalidades: ['contrato', 'indenizatorio'] },
  { id: 'locacao_pf',        label: 'Locação de Imóvel — Pessoa Física',       anexos: 'Anexo VI Item 1',      modalidades: ['contrato'] },
  { id: 'locacao_pj',        label: 'Locação de Imóvel — Pessoa Jurídica',     anexos: 'Anexo I + Anexo VI Item 2', modalidades: ['contrato'] },
  { id: 'monopolio',         label: 'Monopólio / Locação em geral',            anexos: 'Apenas Anexo I',       modalidades: ['contrato'] },
] as const;

export type SegmentoId = typeof SEGMENTOS[number]['id'];
export type Modalidade = 'contrato' | 'indenizatorio';
```

- [ ] **Passo 2:** Verificar build: `npm run build`

---

## Tarefa 2: Regras de segmento (`segment-rules.ts`)

**Arquivo:** `src/lib/segment-rules.ts` (NOVO)

- [ ] **Passo 1:** Criar o arquivo com o mapeamento completo

```typescript
import type { SegmentoId, Modalidade } from '@/lib/types';

export interface ChecklistItem {
  descricao: string;
  detalhe: string;
}

export interface SegmentChecklist {
  regularidade: ChecklistItem[];
  instrucao: ChecklistItem[];
}

// ─── Blocos reutilizáveis ────────────────────────────────────────────────────

const REGULARIDADE_PJ: ChecklistItem[] = [
  {
    descricao: 'Cartão CNPJ',
    detalhe: 'Emitido nos últimos 90 dias.',
  },
  {
    descricao: 'Certificado de Regularidade do FGTS (CRF)',
    detalhe: 'Válido na data de emissão do relatório. Mínimo 5 dias de margem antes do vencimento.',
  },
  {
    descricao: 'CND — Tributos Federais e Dívida Ativa da União',
    detalhe: 'Certidão Negativa (ou Positiva com Efeitos de Negativa) de Débitos relativos a Créditos Tributários Federais e à Dívida Ativa da União. Vigente.',
  },
  {
    descricao: 'CND — Débitos Estaduais',
    detalhe: 'Certidão Negativa de Débitos Estaduais emitida pela SEFAZ-MA. Vigente.',
  },
  {
    descricao: 'CND — Inscrição de Débitos na Dívida Ativa Estadual',
    detalhe: 'Certidão Negativa de Inscrição na Dívida Ativa Estadual emitida pela PGE-MA. Vigente.',
  },
  {
    descricao: 'Consulta Optante Simples Nacional',
    detalhe: 'Emitida nos últimos 90 dias.',
  },
  {
    descricao: 'Cadastro Estadual de Inadimplentes (CEI)',
    detalhe: 'Presente no processo (sem prazo específico de emissão conforme Portaria 279/2025).',
  },
];

const REGULARIDADE_PJ_COM_CNDT: ChecklistItem[] = [
  ...REGULARIDADE_PJ.slice(0, 3),
  {
    descricao: 'CNDT — Certidão Negativa de Débitos Trabalhistas',
    detalhe: 'Emitida pelo TST. Obrigatória para contratações com cessão de mão de obra e serviços de engenharia. Vigente.',
  },
  ...REGULARIDADE_PJ.slice(3),
];

const INSTRUCAO_SOLICITACAO: ChecklistItem = {
  descricao: 'Solicitação de pagamento da empresa (com dados bancários)',
  detalhe: 'Deve ser realizada por proprietário/sócio ou por representante com procuração. Para pagamentos do Parecer 002/2017-ASS/PGE/MA: acompanhar Estatuto Social da empresa.',
};

const INSTRUCAO_NF: ChecklistItem = {
  descricao: 'Nota Fiscal e/ou Fatura',
  detalhe: 'Com número do contrato e nome da unidade de saúde no campo observações. Para serviços: incluir retenções na fonte, alíquota do Simples (ISS), local da prestação, código e descrição do serviço, mês de referência.',
};

const INSTRUCAO_OS: ChecklistItem = {
  descricao: 'Cópia da Ordem de Serviço ou Ordem de Fornecimento',
  detalhe: 'Documento autorizativo da execução dos serviços ou do fornecimento dos materiais.',
};

const INSTRUCAO_RAF: ChecklistItem = {
  descricao: 'Relatório de Acompanhamento e Fiscalização do Contrato + Cronograma de Desembolso Financeiro',
  detalhe: 'Devidamente assinados pelo fiscal do contrato.',
};

const INSTRUCAO_KIT_CONTRATO: ChecklistItem = {
  descricao: 'Kit Contrato (referência ao processo SEI)',
  detalhe: 'Referência ao número do processo SEI onde consta: cópia do contrato, publicação do extrato no Diário Oficial do Estado, aditivos, extratos dos termos aditivos no DOE, apostilamentos (se houver) e portaria de fiscais do contrato.',
};

const INSTRUCAO_MANIFESTACAO: ChecklistItem = {
  descricao: 'Manifestação da Autoridade Competente e despacho',
  detalhe: 'Manifestação técnica da área demandante assinada, justificativas e Termo de Apensamento (quando aplicável).',
};

const INSTRUCAO_CONTABIL: ChecklistItem = {
  descricao: 'Relatório Contábil, Disponibilidade Financeira e Memorando Contábil',
  detalhe: 'Relatório de lançamentos contábil e fiscal, disponibilidade financeira e memorando com número correspondente.',
};

const INSTRUCAO_PLANO_OPERATIVO: ChecklistItem = {
  descricao: 'Plano operativo e indicação da linha de despesa',
  detalhe: 'Indicação da unidade, descrição da linha de despesa e informações sobre remanejamentos.',
};

// Bloco exclusivo para modalidade indenizatória (substitui Kit Contrato + RAF)
const INSTRUCAO_PARECER_INDENIZATORIO: ChecklistItem = {
  descricao: 'Parecer Referencial / Parecer Normativo nº 002/2017-ASS/PGE/MA',
  detalhe: 'Indicação do Parecer que fundamenta o pagamento indenizatório (despesa sem cobertura contratual). Mencionar número do ID no SEI.',
};

// ─── Construtor por segmento ─────────────────────────────────────────────────

function buildFornecedor(modalidade: Modalidade): SegmentChecklist {
  const instrucao: ChecklistItem[] = [
    INSTRUCAO_SOLICITACAO,
    INSTRUCAO_NF,
    INSTRUCAO_OS,
    {
      descricao: 'Relatório de Fornecimento ou Prestação de Serviços',
      detalhe: 'Documento comprobatório da entrega do material ou da prestação do serviço. Para OPME: + relatório médico e comprovante de gasto de sala. Para alimentação/nutrição: + cardápio e demonstrativo de refeições. Para laboratório: nome do paciente, data, rol de exames, valores unitários e número do cartão SUS. Para água mineral: recibos de entrega assinados e carimbados.',
    },
  ];

  if (modalidade === 'contrato') {
    instrucao.push(INSTRUCAO_RAF, INSTRUCAO_PLANO_OPERATIVO, INSTRUCAO_KIT_CONTRATO);
  } else {
    instrucao.push(INSTRUCAO_PARECER_INDENIZATORIO);
  }

  instrucao.push(INSTRUCAO_MANIFESTACAO, INSTRUCAO_CONTABIL);

  return { regularidade: REGULARIDADE_PJ, instrucao };
}

function buildCessaoMaoObra(modalidade: Modalidade): SegmentChecklist {
  const instrucao: ChecklistItem[] = [
    INSTRUCAO_SOLICITACAO,
    INSTRUCAO_NF,
    INSTRUCAO_OS,
    {
      descricao: 'Comprovação de encargos sociais e previdenciários',
      detalhe: 'Cópia das Guias de Recolhimento do INSS e do FGTS compatíveis com os empregados à execução do serviço, nominalmente identificados (Decreto Federal nº 3.048/1999). Comprovantes de pagamento de salários (remuneração), inclusive férias e 13º salário (quando houver), vale-transporte e vale-alimentação, todos correspondentes ao mês da última nota fiscal ou fatura vencida.',
    },
    {
      descricao: 'Convenção Coletiva de Trabalho (CCT) vigente',
      detalhe: 'CCT aplicável à categoria dos trabalhadores terceirizados, vigente para o período de referência.',
    },
  ];

  if (modalidade === 'contrato') {
    instrucao.push(INSTRUCAO_RAF, INSTRUCAO_PLANO_OPERATIVO, INSTRUCAO_KIT_CONTRATO);
  } else {
    instrucao.push(INSTRUCAO_PARECER_INDENIZATORIO);
  }

  instrucao.push(INSTRUCAO_MANIFESTACAO, INSTRUCAO_CONTABIL);

  return { regularidade: REGULARIDADE_PJ_COM_CNDT, instrucao };
}

function buildEngenharia(): SegmentChecklist {
  const instrucao: ChecklistItem[] = [
    INSTRUCAO_SOLICITACAO,
    INSTRUCAO_NF,
    INSTRUCAO_OS,
    {
      descricao: 'Cópia da ART — Anotação de Responsabilidade Técnica (CREA/MA ou equivalente)',
      detalhe: 'Obrigatória para todos os serviços de engenharia.',
    },
    {
      descricao: 'Relatórios de execução e laudos técnicos específicos',
      detalhe: 'Para ETE/ETA/caixa d\'água/potabilidade/hemodiálise/chiller: relatórios de execução e laudos de análises. Para coleta/transporte/tratamento de resíduos: boletim de medição, MTR (Manifesto de Transporte de Resíduos) e licença de operação emitida pelo órgão competente.',
    },
    INSTRUCAO_RAF,
    INSTRUCAO_PLANO_OPERATIVO,
    INSTRUCAO_KIT_CONTRATO,
    INSTRUCAO_MANIFESTACAO,
    INSTRUCAO_CONTABIL,
  ];

  return { regularidade: REGULARIDADE_PJ_COM_CNDT, instrucao };
}

function buildServicosMedicos(modalidade: Modalidade): SegmentChecklist {
  const instrucao: ChecklistItem[] = [
    INSTRUCAO_SOLICITACAO,
    INSTRUCAO_NF,
    {
      descricao: 'Relação de honorários médicos atestada pelo responsável da empresa',
      detalhe: 'Deve conter: nome da unidade de saúde, nome da empresa e CNPJ, dia/mês/ano/turno/horário e carga horária, nome(s) do(s) profissional(is), número do registro no conselho e especialidade, quantidade de plantões/ambulatórios realizados, valor unitário e total. Para ambulatório com SISREG: relatório circunstanciado com nomes dos pacientes, data de atendimento e quantidade de consultas. Para ambulatório sem SISREG: mesmo relatório em papel timbrado. Para exames: lista de pacientes, data, descrição, quantitativos, cartão SUS, valores. Para cirurgias: data, nomes, cartão SUS, profissional e tipo de cirurgia.',
    },
    {
      descricao: 'Quadro Societário (QSA) — extraído do site da Receita Federal',
      detalhe: 'Obrigatório para todas as prestadoras de serviços médicos. Para institutos: também exigidos Ata atualizada dos sócios autenticada em cartório e Declaração de imunidade dos tributos federais.',
    },
  ];

  if (modalidade === 'contrato') {
    instrucao.push(INSTRUCAO_RAF, INSTRUCAO_PLANO_OPERATIVO, INSTRUCAO_KIT_CONTRATO);
  } else {
    instrucao.push(INSTRUCAO_PARECER_INDENIZATORIO);
  }

  instrucao.push(INSTRUCAO_MANIFESTACAO, INSTRUCAO_CONTABIL);

  return { regularidade: REGULARIDADE_PJ, instrucao };
}

function buildLocacaoPF(): SegmentChecklist {
  const regularidade: ChecklistItem[] = [
    {
      descricao: 'Certidão Negativa de Débitos do IPTU ou Nada Consta do IPTU do imóvel locado',
      detalhe: 'Emitida pela prefeitura do município onde o imóvel está localizado.',
    },
    {
      descricao: 'CND — Tributos Federais e Dívida Ativa da União (proprietário do imóvel)',
      detalhe: 'Certidão Conjunta Negativa de Débitos Relativos aos Tributos Federais e à Dívida Ativa da União, em nome do proprietário. Vigente.',
    },
    {
      descricao: 'CND — Débitos Estaduais (proprietário do imóvel)',
      detalhe: 'Certidão Negativa de Débito na esfera Estadual em nome do proprietário. Vigente.',
    },
    {
      descricao: 'CND — Dívida Ativa Estadual (proprietário do imóvel)',
      detalhe: 'Certidão Negativa de Dívida Ativa na esfera Estadual em nome do proprietário. Vigente.',
    },
    {
      descricao: 'Cadastro Estadual de Inadimplentes (CEI) — proprietário do imóvel',
      detalhe: 'Em nome do proprietário do imóvel.',
    },
  ];

  const instrucao: ChecklistItem[] = [
    {
      descricao: 'Solicitação do proprietário do imóvel (com dados bancários)',
      detalhe: 'Se houver outorgado: procuração com firma reconhecida em cartório demonstrando os poderes conferidos.',
    },
    {
      descricao: 'Cópia do RG do solicitante (Parecer 002/2017-ASS/PGE/MA)',
      detalhe: 'Documento de identidade do proprietário ou do outorgado.',
    },
    {
      descricao: 'Fatura em nome do proprietário do imóvel',
      detalhe: 'Fatura de aluguel emitida em nome do proprietário.',
    },
    {
      descricao: 'Certidão Vintenária ou Registro/Escritura Pública do imóvel',
      detalhe: 'Cópia autenticada em cartório.',
    },
    {
      descricao: 'Comprovante de endereço atualizado do proprietário do imóvel',
      detalhe: 'Documento recente comprovando o endereço do proprietário.',
    },
    {
      descricao: 'Cópia da Identidade e CPF do proprietário do imóvel',
      detalhe: 'Documentos de identificação pessoal do proprietário.',
    },
    INSTRUCAO_MANIFESTACAO,
    INSTRUCAO_CONTABIL,
  ];

  return { regularidade, instrucao };
}

function buildLocacaoPJ(): SegmentChecklist {
  const instrucao: ChecklistItem[] = [
    INSTRUCAO_SOLICITACAO,
    INSTRUCAO_NF,
    {
      descricao: 'Certidão Vintenária ou Registro/Escritura Pública do imóvel',
      detalhe: 'Cópia autenticada em cartório.',
    },
    {
      descricao: 'Certidão Negativa de Débitos do IPTU ou Nada Consta do IPTU do imóvel locado',
      detalhe: 'Emitida pela prefeitura do município onde o imóvel está localizado.',
    },
    INSTRUCAO_KIT_CONTRATO,
    INSTRUCAO_MANIFESTACAO,
    INSTRUCAO_CONTABIL,
  ];

  return { regularidade: REGULARIDADE_PJ, instrucao };
}

function buildMonopolio(): SegmentChecklist {
  const instrucao: ChecklistItem[] = [
    INSTRUCAO_SOLICITACAO,
    INSTRUCAO_NF,
    INSTRUCAO_MANIFESTACAO,
    INSTRUCAO_CONTABIL,
  ];

  return { regularidade: REGULARIDADE_PJ, instrucao };
}

// ─── Export principal ────────────────────────────────────────────────────────

export function getSegmentChecklist(segmento: SegmentoId, modalidade: Modalidade): SegmentChecklist {
  switch (segmento) {
    case 'fornecedor':       return buildFornecedor(modalidade);
    case 'cessao_mao_obra':  return buildCessaoMaoObra(modalidade);
    case 'engenharia':       return buildEngenharia();
    case 'servicos_medicos': return buildServicosMedicos(modalidade);
    case 'locacao_pf':       return buildLocacaoPF();
    case 'locacao_pj':       return buildLocacaoPJ();
    case 'monopolio':        return buildMonopolio();
  }
}

export function getSegmentLabel(segmento: SegmentoId): string {
  const found = [
    { id: 'fornecedor', label: 'Fornecedor (materiais / serviços)' },
    { id: 'cessao_mao_obra', label: 'Cessão de Mão de Obra (terceirização)' },
    { id: 'engenharia', label: 'Serviços de Engenharia' },
    { id: 'servicos_medicos', label: 'Serviços Médicos' },
    { id: 'locacao_pf', label: 'Locação de Imóvel — Pessoa Física' },
    { id: 'locacao_pj', label: 'Locação de Imóvel — Pessoa Jurídica' },
    { id: 'monopolio', label: 'Monopólio / Locação em geral' },
  ].find(s => s.id === segmento);
  return found?.label ?? segmento;
}
```

- [ ] **Passo 2:** Verificar build: `npm run build`

---

## Tarefa 3: Refatorar `prompt.ts` para prompt dinâmico

**Arquivo:** `src/lib/prompt.ts`

- [ ] **Passo 1:** Substituir o conteúdo completo pelo prompt dinâmico

```typescript
import { getSegmentChecklist, getSegmentLabel, type ChecklistItem } from '@/lib/segment-rules';
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

export function buildSystemPrompt(segmento: SegmentoId, modalidade: Modalidade): string {
  const checklist = getSegmentChecklist(segmento, modalidade);
  const segLabel = getSegmentLabel(segmento);
  const modLabel = modalidade === 'contrato' ? 'Contrato' : 'Indenizatório';
  const nReg = checklist.regularidade.length;
  const nInstr = checklist.instrucao.length;
  const nTotal = nReg + nInstr;

  return `Você é um auditor especialista da GCIF (Gerência de Controle Interno Financeiro) da EMSERH — Empresa Maranhense de Serviços Hospitalares. Sua função é analisar processos administrativos de pagamento e verificar a conformidade com a checklist obrigatória baseada nas Portarias nº 439/2024 e nº 279/2025-GAB/EMSERH.

SEGMENTO DO PROCESSO: ${segLabel} | Modalidade: ${modLabel}
O checklist para este segmento tem ${nTotal} itens (${nReg} de regularidade fiscal/trabalhista + ${nInstr} de instrução processual).

${BASE_LEGAL}

${STATUS_RULES}

${KNOWN_VARIANTS}

CHECKLIST DE REGULARIDADE FISCAL E TRABALHISTA (${nReg} itens):
${formatItems(checklist.regularidade)}

CHECKLIST DE INSTRUÇÃO PROCESSUAL (${nInstr} itens):
${formatItems(checklist.instrucao)}

INSTRUÇÕES DE ANÁLISE:
1. Leia todo o texto extraído do PDF (incluindo páginas digitais e OCR de páginas escaneadas).
2. Para cada item do checklist, determine o status com base nas evidências textuais encontradas.
3. Para cada item, extraia a citação textual exata (campo "citacao") que fundamenta a decisão, indicando a página estimada.
4. Se um item não encontrar evidência no processo, classifique como NAO_CONFORME com motivo "Documento não localizado no processo".
5. Para itens de regularidade com data de validade, extraia a data e avalie se está vigente.
6. A decisão final (conclusao.decisao_geral) deve refletir o conjunto de todos os itens avaliados.
7. Responda SOMENTE com o JSON estruturado via tool call — nenhum texto fora da tool call.`;
}

export function buildUserPrompt(extractedText: string, segmento: SegmentoId, modalidade: Modalidade): string {
  const checklist = getSegmentChecklist(segmento, modalidade);
  const nTotal = checklist.regularidade.length + checklist.instrucao.length;
  return `Analise o processo administrativo de pagamento a seguir e preencha todos os ${nTotal} itens do checklist de conformidade via tool call "submit_analysis".

Texto extraído do PDF (por página):
${extractedText}`;
}
```

- [ ] **Passo 2:** Verificar build: `npm run build`

---

## Tarefa 4: Atualizar `claude-analyzer.ts`

**Arquivo:** `src/lib/claude-analyzer.ts`

- [ ] **Passo 1:** Atualizar a assinatura de `analyzeWithClaude` e o TOOL_DEFINITION para aceitar contagens dinâmicas

Substituir o `TOOL_DEFINITION` (remover `minItems/maxItems` fixos) e atualizar `analyzeWithClaude` e `callClaude`:

```typescript
import { AnalysisResultSchema, type AnalysisResult, type SegmentoId, type Modalidade } from '@/lib/types';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompt';
import { logger } from '@/lib/logger';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 16000;
const RETRY_DELAYS_MS = [1000, 3000, 9000];

const CHECKLIST_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    item: { type: 'integer' },
    descricao: { type: 'string' },
    status: { type: 'string', enum: ['CONFORME', 'NAO_CONFORME', 'ATENCAO'] },
    motivo: { type: ['string', 'null'] },
    documento_verificador: { type: ['string', 'null'] },
    citacao: { type: 'string' },
    pagina_estimada: { type: 'integer' },
    observacoes: { type: 'string' },
    sugestao_correcao: { type: ['string', 'null'] },
  },
  required: ['item', 'descricao', 'status', 'motivo', 'documento_verificador', 'citacao', 'pagina_estimada', 'observacoes', 'sugestao_correcao'],
};

const TOOL_DEFINITION = {
  name: 'submit_analysis',
  description: 'Submete o resultado estruturado da análise de conformidade do processo de pagamento.',
  input_schema: {
    type: 'object',
    properties: {
      identificacao_contrato: {
        type: 'object',
        properties: {
          credor: { type: 'string' },
          cnpj: { type: 'string' },
          contrato_numero: { type: 'string' },
          objeto: { type: 'string' },
          periodo_referencia: { type: 'string' },
          processo_sei: { type: 'string' },
          valor_total: { type: 'string' },
        },
        required: ['credor', 'cnpj', 'contrato_numero', 'objeto', 'periodo_referencia', 'processo_sei', 'valor_total'],
      },
      regularidade_fiscal_trabalhista: {
        type: 'array',
        minItems: 1,
        items: CHECKLIST_ITEM_SCHEMA,
      },
      instrucao_processual: {
        type: 'array',
        minItems: 1,
        items: {
          ...CHECKLIST_ITEM_SCHEMA,
          properties: {
            ...CHECKLIST_ITEM_SCHEMA.properties,
            data_validade: { type: ['string', 'null'] },
          },
        },
      },
      conclusao: {
        type: 'object',
        properties: {
          decisao_geral: { type: 'string', enum: ['CONFORME', 'NAO_CONFORME', 'PENDENTE_AJUSTES'] },
          resumo: { type: 'string' },
          total_itens_conformes: { type: 'integer' },
          total_itens_nao_conformes: { type: 'integer' },
          total_itens_atencao: { type: 'integer' },
          lista_pendencias: { type: 'array', items: { type: 'string' } },
        },
        required: ['decisao_geral', 'resumo', 'total_itens_conformes', 'total_itens_nao_conformes', 'total_itens_atencao', 'lista_pendencias'],
      },
    },
    required: ['identificacao_contrato', 'regularidade_fiscal_trabalhista', 'instrucao_processual', 'conclusao'],
  },
};

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY não configurada');
  return key;
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    signal: AbortSignal.timeout(240_000),
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: [TOOL_DEFINITION],
      tool_choice: { type: 'tool', name: 'submit_analysis' },
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude API ${response.status}: ${body}`);
  }

  const data = await response.json();

  if (data.stop_reason === 'max_tokens') {
    logger.error({ stop_reason: 'max_tokens', usage: data.usage }, 'claude_response_truncated');
    throw new Error('A resposta do Claude foi cortada por exceder o limite de tokens. Tente um documento menor ou divida o processo em partes.');
  }

  const toolUse = data.content?.find(
    (block: { type: string }) => block.type === 'tool_use',
  ) as { type: string; name: string; input: unknown } | undefined;

  if (!toolUse) {
    logger.error({ stop_reason: data.stop_reason, content_types: data.content?.map((b: { type: string }) => b.type) }, 'claude_no_tool_use');
    throw new Error('Resposta do Claude não contém tool_use.');
  }

  logger.info({ stop_reason: data.stop_reason, usage: data.usage }, 'claude_tool_use_received');
  return toolUse.input;
}

export async function analyzeWithClaude(
  extractedText: string,
  segmento: SegmentoId,
  modalidade: Modalidade,
): Promise<AnalysisResult> {
  const systemPrompt = buildSystemPrompt(segmento, modalidade);
  const userPrompt = buildUserPrompt(extractedText, segmento, modalidade);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      logger.info({ attempt, segmento, modalidade }, 'claude_analyze_attempt');
      const raw = await callClaude(systemPrompt, userPrompt);
      const parsed = AnalysisResultSchema.parse(raw);
      logger.info({ decisao: parsed.conclusao.decisao_geral }, 'claude_analyze_done');
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRetryable =
        lastError.message.includes('529') ||
        lastError.message.includes('503') ||
        lastError.message.includes('overloaded');
      if (!isRetryable || attempt >= RETRY_DELAYS_MS.length) break;
      logger.warn({ attempt, delay: RETRY_DELAYS_MS[attempt] }, 'claude_analyze_retry');
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }

  throw lastError ?? new Error('Falha desconhecida na análise Claude');
}
```

- [ ] **Passo 2:** Verificar build: `npm run build`

---

## Tarefa 5: Atualizar `route.ts`

**Arquivo:** `src/app/api/analyze/route.ts`

- [ ] **Passo 1:** Ler `segmento` e `modalidade` do FormData e passar ao `analyzeWithClaude`

Adicionar após `const entries = formData.getAll('files') as File[];`:

```typescript
const segmento = (formData.get('segmento') as string | null) ?? 'fornecedor';
const modalidade = (formData.get('modalidade') as string | null) ?? 'contrato';
```

Alterar a chamada de `analyzeWithClaude`:
```typescript
// ANTES:
analysis = await analyzeWithClaude(extracted.consolidatedText);
// DEPOIS:
analysis = await analyzeWithClaude(
  extracted.consolidatedText,
  segmento as import('@/lib/types').SegmentoId,
  modalidade as import('@/lib/types').Modalidade,
);
```

- [ ] **Passo 2:** Verificar build: `npm run build`

---

## Tarefa 6: Criar `SegmentSelector.tsx`

**Arquivo:** `src/components/SegmentSelector.tsx` (NOVO)

- [ ] **Passo 1:** Criar o componente

```typescript
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
  const modalidadesDisponiveis = segConfig?.modalidades ?? ['contrato', 'indenizatorio'];

  function handleSegmento(e: React.ChangeEvent<HTMLSelectElement>) {
    const novoSegmento = e.target.value as SegmentoId | '';
    const config = SEGMENTOS.find(s => s.id === novoSegmento);
    const novaModalidade = config && !config.modalidades.includes(modalidade as Modalidade)
      ? config.modalidades[0] as Modalidade
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
```

- [ ] **Passo 2:** Verificar build: `npm run build`

---

## Tarefa 7: Atualizar `page.tsx`

**Arquivo:** `src/app/page.tsx`

- [ ] **Passo 1:** Adicionar import e estados

```typescript
// Adicionar ao bloco de imports:
import { SegmentSelector } from '@/components/SegmentSelector';
import type { SegmentoId, Modalidade } from '@/lib/types';

// Adicionar dentro do componente Home(), junto aos outros estados:
const [segmento, setSegmento] = useState<SegmentoId | ''>('');
const [modalidade, setModalidade] = useState<Modalidade>('contrato');
```

- [ ] **Passo 2:** Passar segmento/modalidade no FormData

```typescript
// Dentro de runAnalysis(), após `for (const f of files) formData.append('files', f);`:
formData.append('segmento', segmento || 'fornecedor');
formData.append('modalidade', modalidade);
```

- [ ] **Passo 3:** Bloquear dropzone se segmento não selecionado

Na prop `disabled` do `<UploadArea>`:
```typescript
// ANTES:
<UploadArea onFilesSelected={handleFilesAdded} disabled={isProcessing} />
// DEPOIS:
<UploadArea onFilesSelected={handleFilesAdded} disabled={isProcessing || !segmento} />
```

- [ ] **Passo 4:** Renderizar `<SegmentSelector>` antes do card de upload

```typescript
// Adicionar ANTES do bloco `{!isProcessing && stage !== 'done' && (` do card de upload:
{!isProcessing && stage !== 'done' && (
  <SegmentSelector
    segmento={segmento}
    modalidade={modalidade}
    onChange={(s, m) => { setSegmento(s); setModalidade(m); }}
  />
)}
```

- [ ] **Passo 5:** Resetar segmento ao clicar "Nova análise"

```typescript
// No onClick do botão "← Nova análise", adicionar:
setSegmento('');
setModalidade('contrato');
```

- [ ] **Passo 6:** Verificar build: `npm run build`

---

## Tarefa 8: Estilos CSS (`globals.css`)

**Arquivo:** `src/app/globals.css`

- [ ] **Passo 1:** Adicionar antes da seção `/* ===== Responsive =====*/`

```css
/* ===== Segment selector ===== */
.segment-row { display: grid; grid-template-columns: 1fr 200px; gap: 14px; }
.segment-field { display: flex; flex-direction: column; gap: 5px; }
.segment-label { font-size: 11.5px; font-weight: 600; color: var(--em-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.segment-select {
  appearance: none;
  background: var(--paper-soft) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 12px center;
  border: 1px solid var(--em-border);
  border-radius: 8px;
  padding: 9px 32px 9px 12px;
  font-size: 13px;
  color: var(--ink-1);
  font-family: var(--font-sans);
  cursor: pointer;
  transition: border-color 0.15s;
}
.segment-select:focus { outline: none; border-color: var(--emserh-navy); box-shadow: 0 0 0 3px rgba(10,35,81,0.08); }
.segment-select:disabled { opacity: 0.45; cursor: not-allowed; }
.segment-hint { display: flex; align-items: flex-start; gap: 8px; margin-top: 12px; padding: 10px 12px; background: rgba(10,35,81,0.04); border-radius: 8px; border-left: 3px solid var(--emserh-navy); }
.segment-hint-icon { font-size: 14px; color: var(--emserh-navy); flex-shrink: 0; margin-top: 1px; }
.segment-hint span { font-size: 12px; color: var(--ink-2); line-height: 1.5; }
.segment-anexo-badge { display: inline-block; background: var(--emserh-navy); color: white; font-size: 10.5px; font-weight: 600; padding: 2px 8px; border-radius: 999px; white-space: nowrap; flex-shrink: 0; align-self: center; }
@media (max-width: 600px) { .segment-row { grid-template-columns: 1fr; } }
```

- [ ] **Passo 2:** Verificar build: `npm run build`

---

## Tarefa 9: Build final + commit + push

- [ ] **Passo 1:** `npm run build` — build deve passar sem erros TypeScript

- [ ] **Passo 2:** Commit e push

```bash
git add src/lib/segment-rules.ts src/lib/types.ts src/lib/prompt.ts src/lib/claude-analyzer.ts \
        src/app/api/analyze/route.ts src/components/SegmentSelector.tsx \
        src/app/page.tsx src/app/globals.css
git commit -m "feat: seletor de segmento + regras dinâmicas por anexo (Portarias 439 + 279)

Implementa 7 segmentos (Fornecedor, Cessão MdO, Engenharia, Serviços Médicos,
Locação PF/PJ, Monopólio) e 2 modalidades (Contrato/Indenizatório). O prompt
do Claude é montado dinamicamente com o checklist correto de cada segmento
conforme a Cartilha GCIF 2026, Portaria 439/2024 e Portaria 279/2025.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
```
