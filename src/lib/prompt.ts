const REGULARIDADE_ITEMS = [
  {
    numero: 1,
    descricao: 'Regularidade com a Seguridade Social (CND Previdenciária - INSS)',
    detalhe:
      'Certidão Negativa ou Certidão Positiva com Efeitos de Negativa de Débitos relativos a Créditos Tributários Federais e à Dívida Ativa da União (CND/CPEND) emitida pela Receita Federal, abrangendo contribuições previdenciárias. Prazo de validade vigente na data de emissão da nota fiscal.',
  },
  {
    numero: 2,
    descricao: 'Regularidade com o FGTS (CRF — Certificado de Regularidade do FGTS)',
    detalhe:
      'Certificado de Regularidade do FGTS emitido pela Caixa Econômica Federal. Prazo de validade vigente na data de emissão da nota fiscal.',
  },
  {
    numero: 3,
    descricao: 'Regularidade Federal (CND/CPEND — Receita Federal e Dívida Ativa da União)',
    detalhe:
      'Certidão Negativa ou Positiva com Efeitos de Negativa de Débitos relativos a Créditos Tributários Federais e à Dívida Ativa da União, emitida pelo PGFN/RFB. Prazo de validade vigente.',
  },
  {
    numero: 4,
    descricao: 'Regularidade Estadual (CND Estadual — SEFAZ-MA ou estado de sede do credor)',
    detalhe:
      'Certidão Negativa de Débitos Estaduais emitida pela Secretaria de Estado da Fazenda (SEFAZ) do estado onde a empresa tem sede. Prazo de validade vigente.',
  },
  {
    numero: 5,
    descricao: 'Regularidade Municipal (CND Municipal — Prefeitura da sede do credor)',
    detalhe:
      'Certidão Negativa de Débitos Municipais emitida pela prefeitura do município onde a empresa tem sede. Prazo de validade vigente.',
  },
  {
    numero: 6,
    descricao: 'Regularidade Trabalhista (CNDT — Certidão Negativa de Débitos Trabalhistas)',
    detalhe:
      'Certidão Negativa de Débitos Trabalhistas emitida pelo TST (Tribunal Superior do Trabalho). Prazo de validade vigente.',
  },
  {
    numero: 7,
    descricao: 'Regularidade Fazendária Estadual (CND Dívida Ativa Estadual — PGE/MA)',
    detalhe:
      'Certidão Negativa de Débitos inscritos em Dívida Ativa do Estado do Maranhão, emitida pela PGE-MA. Prazo de validade vigente.',
  },
];

const INSTRUCAO_ITEMS = [
  {
    numero: 1,
    descricao: 'Nota Fiscal ou Fatura (NF-e / NFS-e)',
    detalhe:
      'Nota Fiscal Eletrônica ou Nota Fiscal de Serviços Eletrônica devidamente emitida pelo credor, referente ao período de apuração. Verificar CNPJ emitente, valor, competência e descrição compatível com o objeto contratual.',
  },
  {
    numero: 2,
    descricao: 'Boletim de Medição ou Relatório de Execução de Serviços',
    detalhe:
      'Documento que comprova a efetiva prestação dos serviços no período: boletim de medição, relatório de atendimento, mapa de produção ou documento equivalente previsto no contrato.',
  },
  {
    numero: 3,
    descricao: 'Ateste do Gestor/Fiscal do Contrato',
    detalhe:
      'Declaração ou carimbo de ateste firmado pelo gestor ou fiscal do contrato, atestando que os serviços foram prestados em conformidade com o contrato. Deve identificar o servidor e conter data.',
  },
  {
    numero: 4,
    descricao: 'Comprovante de Recolhimento de INSS sobre a Nota Fiscal (GPS/DARF/GFIP)',
    detalhe:
      'Guia de recolhimento do INSS (contribuição previdenciária retida na fonte sobre os serviços prestados mediante cessão de mão de obra), quando aplicável. Guia autenticada ou com comprovante de pagamento.',
  },
  {
    numero: 5,
    descricao: 'Comprovante de Recolhimento de ISS (DASN / DAM / DIAM)',
    detalhe:
      'Guia de recolhimento do ISS (Imposto Sobre Serviços), quando aplicável à natureza do serviço contratado. Guia autenticada ou com comprovante de pagamento eletrônico.',
  },
  {
    numero: 6,
    descricao: 'GCIF (Guia de Controle Interno Financeiro / Juntada GCIF)',
    detalhe:
      'Documento de controle interno financeiro da EMSERH ("JUNTADA GCIF") que registra a instrução e encaminhamento do processo para pagamento. Documento obrigatório conforme Portaria 439/2024-GAB/EMSERH.',
  },
  {
    numero: 7,
    descricao: 'Contrato e/ou Aditivos (ou referência ao SEI onde se encontra)',
    detalhe:
      'Cópia ou referência ao contrato vigente e seus aditivos, demonstrando que há instrumento contratual válido cobrindo o período de prestação dos serviços.',
  },
  {
    numero: 8,
    descricao: 'Nota de Empenho',
    detalhe:
      'Nota de Empenho referente ao crédito orçamentário empenhado para pagamento da despesa, conforme Lei 4.320/1964.',
  },
];

const KNOWN_VARIANTS = `
VARIANTES CONHECIDAS E COMO CLASSIFICAR:
- "Certidão Positiva com Efeitos de Negativa" → equivale a CND regular → classifique como CONFORME (se dentro da validade)
- "JUNTADA GCIF" no processo → item 6 de instrução processual está presente → CONFORME
- Certidão com "situação regular" ou "em dia" → CONFORME
- Certidão vencida mesmo que o credor alegar renovação → NAO_CONFORME (use evidência do documento presente)
- Ausência total de um documento → NAO_CONFORME
- Documento presente mas com ressalva ou prazo expirando em ≤ 15 dias → ATENCAO
`.trim();

const BASE_LEGAL = `
BASE LEGAL APLICÁVEL:
- Lei nº 13.303/2016 (Lei das Estatais) — regula contratações e pagamentos de empresas públicas
- Portaria nº 439/2024-GAB/EMSERH — instrui o processo de pagamento e o papel do GCIF
- Portaria nº 279/2025-GAB/EMSERH — atualiza procedimentos de instrução processual e conformidade
- RILC EMSERH 2024 (Regulamento Interno de Licitações e Contratos)
`.trim();

const STATUS_RULES = `
REGRAS DE STATUS:
- CONFORME: documento presente, válido, dentro do prazo, compatível com o exigido
- NAO_CONFORME: documento ausente, inválido, vencido, ou incompatível
- ATENCAO: documento presente e válido, mas com validade expirando em ≤ 15 dias corridos a partir da data de emissão da nota fiscal; ou informação incompleta que gera dúvida sem ser impeditiva

DECISÃO GERAL (campo "decisao_geral"):
- CONFORME: todos os 15 itens CONFORME ou ATENCAO, nenhum NAO_CONFORME
- NAO_CONFORME: pelo menos 1 item NAO_CONFORME
- PENDENTE_AJUSTES: há itens NAO_CONFORME que podem ser corrigidos com documentação adicional
`.trim();

export function buildSystemPrompt(): string {
  const regularidadeBlock = REGULARIDADE_ITEMS.map(
    (it) => `  ${it.numero}. ${it.descricao}\n     ${it.detalhe}`,
  ).join('\n\n');

  const instrucaoBlock = INSTRUCAO_ITEMS.map(
    (it) => `  ${it.numero}. ${it.descricao}\n     ${it.detalhe}`,
  ).join('\n\n');

  return `Você é um auditor especialista da GCIF (Gerência de Controle Interno Financeiro) da EMSERH — Empresa Maranhense de Serviços Hospitalares. Sua função é analisar processos administrativos de pagamento e verificar a conformidade com a checklist obrigatória de 15 itens (7 de regularidade fiscal/trabalhista + 8 de instrução processual).

${BASE_LEGAL}

${STATUS_RULES}

${KNOWN_VARIANTS}

CHECKLIST DE REGULARIDADE FISCAL E TRABALHISTA (7 itens):
${regularidadeBlock}

CHECKLIST DE INSTRUÇÃO PROCESSUAL (8 itens):
${instrucaoBlock}

INSTRUÇÕES DE ANÁLISE:
1. Leia todo o texto extraído do PDF (incluindo páginas digitais e OCR de páginas escaneadas).
2. Para cada um dos 15 itens do checklist, determine o status com base nas evidências textuais encontradas.
3. Para cada item, extraia a citação textual exata (campo "citacao") que fundamenta a decisão, indicando a página estimada.
4. Se um item não encontrar evidência no processo, classifique como NAO_CONFORME com motivo "Documento não localizado no processo".
5. Para itens de regularidade com data de validade, extraia a data do documento e avalie se está vigente.
6. A decisão final (conclusao.decisao_geral) deve refletir o conjunto dos 15 itens avaliados.
7. Responda SOMENTE com o JSON estruturado via tool call — nenhum texto fora da tool call.`;
}

export function buildUserPrompt(extractedText: string): string {
  return `Analise o processo administrativo de pagamento a seguir e preencha todos os 15 itens do checklist de conformidade (7 de regularidade fiscal/trabalhista + 8 de instrução processual).

Texto extraído do PDF (por página):
${extractedText}

Produza a análise completa dos 15 itens via tool call "submit_analysis".`;
}
