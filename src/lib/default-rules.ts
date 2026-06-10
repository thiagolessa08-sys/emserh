import { SEGMENTOS, type SegmentoId, type Modalidade } from '@/lib/types';

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

// ─── Construtores por segmento ────────────────────────────────────────────────

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

// ─── Store padrão (seed + fallback) ───────────────────────────────────────────

// Store: combinações válidas de segmento × modalidade já resolvidas (lista plana).
export type RulesStore = {
  [segmentoId: string]: {
    [modalidade: string]: SegmentChecklist;
  };
};

/** Resolve a combinação a partir das funções de build (lógica original). */
function resolveDefault(segmento: SegmentoId, modalidade: Modalidade): SegmentChecklist {
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

/** Conjunto padrão (seed + fallback): todas as combinações válidas resolvidas. */
export const DEFAULT_RULES: RulesStore = (() => {
  const store: RulesStore = {};
  for (const seg of SEGMENTOS) {
    store[seg.id] = {};
    for (const mod of seg.modalidades) {
      store[seg.id][mod] = resolveDefault(seg.id, mod as Modalidade);
    }
  }
  return store;
})();
