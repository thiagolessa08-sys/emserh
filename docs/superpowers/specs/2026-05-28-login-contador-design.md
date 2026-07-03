# Login de Usuários + Contador de Análises — Design

**Data:** 2026-05-28
**Status:** Aprovado pelo usuário

## Objetivo

Adicionar autenticação real (contas individuais com usuário/senha, criadas pelo admin) exigida para usar todo o app, e um contador de análises por usuário e por data, com dashboard de visualização.

## Decisões (perguntas respondidas)

1. Identidade: **login real** (usuário + senha, contas individuais).
2. Contas: **o admin cria** (não há autocadastro).
3. Login exigido: **para usar o app inteiro**.
4. Contagem: **1 por processo/PDF analisado**.
5. Sem sistema de papéis: usuários comuns fazem login; o admin usa a senha mestra (`ADMIN_PASSWORD`) já existente para gerir regras, usuários e ver o contador.

## Arquitetura

### Armazenamento (mesmo volume `/data`, sem banco)

- **`users.json`** — `{ username, nome, passwordHash, createdAt }[]`. Senha com hash **scrypt** (nativo do Node) no formato `salt:hash` (hex).
- **`analytics.json`** — `{ [data: 'YYYY-MM-DD']: { [username]: number } }`.
- Ambos com o mesmo padrão do `rules-store`: cache em memória, gravação atômica (`.tmp` + rename), fallback seguro.
- Dependência de infra: volume `/data` + `RULES_STORE_PATH` já cobrem o diretório; contas/contador usam o mesmo diretório via `USERS_STORE_PATH` e `ANALYTICS_STORE_PATH` (padrão `<dir de RULES_STORE_PATH ou ./data>`).

### Sessão (compatível com Edge e Node)

- **`src/lib/session.ts`** — `signSession(username)` e `verifySession(token)` usando **Web Crypto** (`crypto.subtle`, HMAC-SHA256), pois a middleware roda no Edge (onde `node:crypto` não está disponível). Assíncronas.
- Segredo: `SESSION_SECRET` (fallback para `ADMIN_PASSWORD` se não definido).
- Token = `username.<hmacHex>`; cookie `session` httpOnly, `SameSite=Strict`, `Secure` em produção, sessão (expira ao fechar).

### Gating do app inteiro

- **`middleware.ts`** (raiz) — verifica a sessão em toda requisição. Sem sessão válida → redireciona para `/login`.
- Exceções (não exigem login de usuário): `/login`, `/api/auth/*`, `/admin` e `/api/admin/*` (protegidos pela senha mestra), `/api/health`, e assets (`/_next`, favicon, imagens públicas).

### Componentes

- **`src/lib/users-store.ts`** (novo) — `listUsers`, `createUser(nome, username, senha)`, `deleteUser(username)`, `verifyLogin(username, senha)`; `hashPassword`/`verifyPassword` (scrypt).
- **`src/lib/analytics-store.ts`** (novo) — `incrementCount(username, data)` (com trava em processo + gravação atômica), `getAnalytics()`.
- **`src/lib/session.ts`** (novo) — sign/verify de sessão (Web Crypto).
- **`middleware.ts`** (novo) — gating.
- **`src/app/login/page.tsx`** + **`src/components/LoginForm.tsx`** (novos) — tela de login.
- **`src/app/api/auth/login/route.ts`**, **`.../logout/route.ts`**, **`.../me/route.ts`** (novos).
- **`src/app/api/admin/users/route.ts`** (novo) — GET/POST/DELETE de usuários (senha mestra).
- **`src/app/api/admin/analytics/route.ts`** (novo) — GET do contador (senha mestra).
- **`src/components/UsersManager.tsx`** (novo) — CRUD de usuários no `/admin`.
- **`src/components/AnalyticsDashboard.tsx`** (novo) — tabela usuário × data.
- **Modificar** `src/app/admin/page.tsx` — abas: Regras | Usuários | Estatísticas.
- **Modificar** `src/app/api/analyze/route.ts` — ler usuário da sessão e incrementar o contador por PDF concluído.
- **Modificar** `src/components/Header.tsx` — exibir nome do usuário logado + botão **Sair**.
- **Modificar** `.env.example` — `SESSION_SECRET`, `USERS_STORE_PATH`, `ANALYTICS_STORE_PATH`.

### Fluxo

```
Login:
  /login → POST /api/auth/login {username, senha}
    → verifyLogin (scrypt) → signSession → cookie → redirect "/"

Uso do app (gated):
  middleware verifica cookie → sem sessão → /login

Análise:
  /api/analyze → verifySession(cookie) → username
    → por PDF concluído: incrementCount(username, hoje)

Admin (senha mestra):
  /admin → aba Usuários → POST/DELETE /api/admin/users
  /admin → aba Estatísticas → GET /api/admin/analytics → tabela
```

## Tratamento de erros

- `users.json`/`analytics.json` ausente → cria vazio (seed); corrompido → fallback vazio + log; nunca derruba a análise.
- Login inválido → 401 com mensagem "Usuário ou senha incorretos".
- Criar usuário duplicado → 409; nome/usuário/senha vazios → 400 (Zod).
- Falha ao incrementar contador → log de erro, **não** interrompe a análise (contador é secundário à auditoria).
- `incrementCount` serializa gravações (fila em processo) para não perder contagens concorrentes.

## Segurança

- scrypt com salt aleatório por usuário; comparação em tempo constante.
- Sessão assinada (HMAC); cookie httpOnly/SameSite=Strict/Secure.
- Middleware bloqueia todo o app; APIs sensíveis reverificam a sessão/senha mestra.

## Premissas

- Instância única (cache + volume single-attach), coerente com o rules-store.
- Volume `/data` configurado no Railway (senão contas/contador somem no deploy).

## Testes (funções puras / com tmp dir)

- `hashPassword`/`verifyPassword` — hash != senha, verify correto/incorreto.
- `session` sign/verify — token válido aceito, adulterado rejeitado.
- `users-store` — criar/listar/remover; duplicado rejeitado (tmp dir).
- `analytics-store` — incrementa, acumula por data, serialização (tmp dir).

## Fora de escopo (YAGNI)

- Papéis/permissões granulares.
- Recuperação de senha por e-mail.
- Autocadastro.
- Múltiplas instâncias.

## Decomposição / ordem de implementação

1. **Auth** (session, users-store, login, middleware, header, gestão de usuários no admin).
2. **Contador** (analytics-store, integração no analyze, dashboard no admin).

Cada etapa mantém o build verde e é testável isoladamente.
