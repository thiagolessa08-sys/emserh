# Auditor de Conformidade EMSERH

Sistema web de auditoria automatizada de processos administrativos de pagamento da EMSERH — Empresa Maranhense de Serviços Hospitalares.

Analisa PDFs de processos de pagamento contra a checklist de 15 itens (7 de regularidade fiscal/trabalhista + 8 de instrução processual) e gera automaticamente o **Relatório de Conformidade** com o resultado da análise.

## Funcionalidades

- Upload de um ou mais PDFs (arraste ou clique)
- Extração de texto nativo + OCR via Mistral para páginas escaneadas
- Análise de conformidade com IA (Claude Sonnet) usando tool_use estruturado
- Checklist de 15 itens com status CONFORME / NÃO CONFORME / ATENÇÃO
- Geração do Relatório de Conformidade em PDF
- PDF original anotado com marcações coloridas por item
- Interface web responsiva com progresso em tempo real

## Base Legal

- Lei nº 13.303/2016 (Lei das Estatais)
- Portaria nº 439/2024-GAB/EMSERH
- Portaria nº 279/2025-GAB/EMSERH
- RILC EMSERH 2024

## Requisitos

- Node.js 20+
- Chave de API Anthropic (Claude Sonnet)
- Chave de API Mistral (OCR)

## Configuração Local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas chaves de API

# 3. Iniciar servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Variáveis de Ambiente

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `ANTHROPIC_API_KEY` | Chave API Anthropic (Claude) | Sim |
| `MISTRAL_API_KEY` | Chave API Mistral (OCR) | Sim |
| `MISTRAL_OCR_ENDPOINT` | Endpoint OCR Mistral | Não (padrão: api.mistral.ai) |

## Deploy no Railway

1. Crie um projeto no [Railway](https://railway.app)
2. Conecte ao repositório Git
3. Configure as variáveis de ambiente (`ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`)
4. O deploy é automático via `railway.toml`

Health check disponível em `/api/health`.

## Testes

```bash
npm test           # todos os testes
npm run test:watch # modo watch
```

47 testes unitários cobrindo: extração nativa PDF, OCR Mistral, pipeline híbrido, normalização de texto, análise Claude, geração de relatório, anotação de PDF, endpoint HTTP.

## Arquitetura

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts   # Endpoint principal POST /api/analyze
│   │   └── health/route.ts    # Health check
│   └── page.tsx               # UI principal (Client Component)
├── components/
│   ├── UploadArea.tsx          # Área de drag-and-drop
│   ├── ProgressIndicator.tsx   # Barra de progresso por etapa
│   └── ResultPanel.tsx         # Painel de resultado + checklists
└── lib/
    ├── types.ts                # Schemas Zod (fonte da verdade)
    ├── logger.ts               # Logger com sanitização PII
    ├── pdf-native-extractor.ts # Extração texto nativo (pdfjs-dist)
    ├── ocr-mistral.ts          # OCR via Mistral API
    ├── pdf-extractor.ts        # Orquestrador híbrido
    ├── text-normalizer.ts      # Normalização de encoding
    ├── date-utils.ts           # Validação de datas de validade
    ├── prompt.ts               # System prompt + checklists EMSERH
    ├── claude-analyzer.ts      # Cliente Claude + retry + Zod
    ├── citation-matcher.ts     # Fuzzy matching citação→página
    ├── pdf-annotator.ts        # Anotação PDF (pdf-lib)
    └── report-generator.tsx    # Relatório de Conformidade (@react-pdf)
```

## LGPD

- PDFs não são persistidos no servidor após a análise
- Logs sanitizam campos sensíveis (paciente, CPF, CNS, nome)
- Arquivos de fixture em `tests/fixtures/` são gitignored
