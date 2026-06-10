# Tela de Administração de Regras por Segmento/Modalidade — Design

**Data:** 2026-05-28
**Status:** Aprovado pelo usuário (aguardando revisão do spec)

## Objetivo

Criar uma tela protegida por senha (`/admin`) que mostra e permite **editar e salvar** os itens de checklist (Regularidade Fiscal/Trabalhista e Instrução Processual) de cada combinação de segmento × modalidade. As edições persistem entre deploys.

## Decisões tomadas (perguntas respondidas)

1. **Funcionalidade:** editar e salvar de verdade (persistência real).
2. **Acesso:** protegido por senha de administrador (env var `ADMIN_PASSWORD`).
3. **Escopo de edição:** somente os itens do checklist (descrição + detalhe). Nomes de segmentos, modalidades e anexos permanecem fixos no código.

## Arquitetura

### Persistência

As regras deixam de viver no código e passam a viver num arquivo JSON (`rules.json`) num **volume persistente do Railway**.

- **Por que JSON e não Postgres:** dataset pequeno (~10 combinações segmento×modalidade), hierárquico, com um único editor por vez (admin da GCIF). Zero schema/ORM/migração.
- **Seed:** as regras hardcoded atuais de `segment-rules.ts` viram o conjunto padrão (`DEFAULT_RULES`). Na primeira execução, se `rules.json` não existir, ele é criado a partir do default. A partir daí, a fonte da verdade é o JSON.
- **Caminho configurável:** `RULES_STORE_PATH` (env var). Padrão em produção: `/data/rules.json` (volume Railway). Padrão em dev local: `./data/rules.json` (gitignored).
- **Pré-requisito de infra:** criar um volume no painel do Railway montado em `/data` (passo manual único). Sem o volume, edições funcionam mas somem no próximo deploy.

### Modelo de dados

```typescript
// Cada item mantém o formato atual { descricao, detalhe }
interface ChecklistItem {
  descricao: string;
  detalhe: string;
}

interface SegmentChecklist {
  regularidade: ChecklistItem[];
  instrucao: ChecklistItem[];
}

// Store: combinações válidas de segmento × modalidade já RESOLVIDAS (lista plana).
// Diferente do código atual (que compõe blocos + condicionais por modalidade),
// o store guarda a lista final de cada combinação — mais simples de editar.
type RulesStore = {
  [segmentoId: string]: {
    [modalidade: string]: SegmentChecklist;
  };
};
```

As ~10 combinações válidas:
- fornecedor: contrato, indenizatório
- cessao_mao_obra: contrato, indenizatório
- engenharia: contrato
- servicos_medicos: contrato, indenizatório
- locacao_pf: contrato
- locacao_pj: contrato
- monopolio: contrato

### Componentes (limites e responsabilidades)

- **`src/lib/rules-store.ts`** (novo) — leitura/escrita do JSON com cache em memória. `getRulesStore()` (carrega + cacheia, seed se ausente), `saveCombination(segmento, modalidade, checklist)` (grava atômico, atualiza cache). Responsabilidade única: persistência.
- **`src/lib/default-rules.ts`** (novo) — `DEFAULT_RULES: RulesStore` gerado a partir da lógica atual de `segment-rules.ts` (todas as 10 combinações resolvidas em listas planas). É o seed e o fallback.
- **`src/lib/segment-rules.ts`** (modificar) — `getSegmentChecklist` passa a ser uma busca pura no store: `getSegmentChecklist(store, segmento, modalidade)`. Mantém `getSegmentLabel`.
- **`src/lib/admin-auth.ts`** (novo) — verificação de senha e do cookie assinado. `checkPassword(pwd)`, `isAuthenticated(cookieValue)`, `makeAuthCookieValue()`.
- **`src/app/admin/page.tsx`** (novo) — tela de administração (login + editor).
- **`src/app/api/admin/login/route.ts`** (novo) — recebe senha, valida, seta cookie httpOnly.
- **`src/app/api/admin/rules/route.ts`** (novo) — GET (lê store) e POST (salva uma combinação). Protegido pelo cookie.

### Fluxo de dados

```
Análise:
  analyzeProcess / triagePages
    → await getRulesStore()  (JSON do volume, ou DEFAULT_RULES se falhar)
    → getSegmentChecklist(store, segmento, modalidade)
    → buildSystemPrompt(checklist, ...) / buildTriageSystemPrompt(checklist, ...)

Edição:
  /admin (login) → cookie → editor
    → GET /api/admin/rules → store atual
    → admin edita itens → POST /api/admin/rules { segmento, modalidade, checklist }
    → valida (Zod) → saveCombination → grava .tmp → rename → atualiza cache
```

## Autenticação

- Senha em `ADMIN_PASSWORD` (env var no Railway).
- Login: `/admin` mostra formulário de senha quando não autenticado → POST `/api/admin/login`.
- Senha correta → seta cookie `admin_auth` httpOnly assinado (HMAC de um valor constante usando `ADMIN_PASSWORD` como segredo). Cookie de sessão (expira ao fechar o navegador), `SameSite=Strict`, `Secure` em produção.
- Toda rota `/admin/*` (server component) e `/api/admin/*` verifica o cookie; sem cookie válido → bloqueia (redireciona ao login / responde 401).

## Tela `/admin`

1. **Não autenticado:** formulário central com campo de senha e botão "Entrar". Senha errada → mensagem de erro.
2. **Autenticado:** seletor de Segmento + Modalidade (reaproveitando o padrão visual do `SegmentSelector`), seguido de duas seções editáveis:
   - **Regularidade Fiscal e Trabalhista** — lista de itens; cada item tem campo "descrição" (input) e "detalhe" (textarea), botão remover; botão "+ Adicionar item" ao fim.
   - **Instrução Processual** — mesma estrutura.
   - Rodapé: "Cancelar" (recarrega do store, descartando edições) e "Salvar alterações".
3. Ao salvar com sucesso → confirmação visual ("Regras atualizadas").

Estilo: reaproveita o design system EMSERH (`globals.css`, cards, cores).

## Tratamento de erros

- **Falha ao carregar `rules.json`** (arquivo ausente/corrompido) → fallback automático para `DEFAULT_RULES`, log de erro. A análise nunca quebra.
- **Falha ao gravar** → API responde erro; UI mostra "Não foi possível salvar, tente novamente".
- **Senha errada** → 401; login mostra mensagem.
- **Payload inválido** (Zod) → 400 com detalhe legível.
- **Volume não montado em dev** → usa caminho local `./data/rules.json`.
- **Gravação atômica** → escreve em `rules.json.tmp` e renomeia, evitando corrupção se o processo cair no meio.

## Premissas

- **Instância única:** o cache em memória e o volume assumem 1 instância do app (típico para ferramenta interna da GCIF). Múltiplas instâncias dividiriam caches — fora de escopo.
- Edição concorrente desprezível (um admin por vez).

## Testes

Funções puras (sem I/O, sem mock de rede):
- `getSegmentChecklist(store, ...)` — resolve a combinação correta; retorna fallback adequado quando a combinação não existe.
- Mesclagem store carregado × `DEFAULT_RULES` (combinações ausentes no arquivo herdam o default).
- Validação Zod do payload de edição (rejeita item sem descrição, aceita item válido).
- `rules-store` read/write usando diretório temporário (seed quando ausente; round-trip de gravação/leitura).
- `admin-auth` — `checkPassword` e validação de cookie (assinatura correta/incorreta).

## Fora de escopo (YAGNI)

- Edição de nomes de segmentos, modalidades ou anexos.
- Histórico/versionamento de alterações.
- Múltiplos usuários com contas individuais.
- Suporte a múltiplas instâncias do app.
