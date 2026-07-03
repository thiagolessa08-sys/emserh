# Login de Usuários + Contador de Análises — Plano de Implementação

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: Use superpowers:executing-plans para implementar este plano tarefa por tarefa. Os passos usam sintaxe de checkbox (`- [ ]`).

**Objetivo:** Autenticação real (contas criadas pelo admin, login obrigatório em todo o app) + contador de análises por usuário/data com dashboard.

**Arquitetura:** Sessão via cookie HMAC (Web Crypto, compatível com a middleware Edge). Contas e contador em JSON no volume `/data` (mesmo padrão do rules-store). Middleware protege todo o app; admin usa a senha mestra já existente para gerir usuários e ver o contador.

**Tech Stack:** Next.js 16, TypeScript, Zod, Vitest, `node:crypto` (scrypt) + Web Crypto (HMAC).

---

## Arquivos afetados

- Criar: `src/lib/session.ts`, `src/lib/users-store.ts`, `src/lib/analytics-store.ts`, `src/lib/admin-guard.ts`
- Criar: `src/middleware.ts`
- Criar: `src/app/login/page.tsx`, `src/components/LoginForm.tsx`
- Criar: `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/auth/me/route.ts`
- Criar: `src/app/api/admin/users/route.ts`, `src/app/api/admin/analytics/route.ts`
- Criar: `src/components/AdminNav.tsx`, `src/components/UsersManager.tsx`, `src/components/AnalyticsDashboard.tsx`
- Criar: `src/app/admin/usuarios/page.tsx`, `src/app/admin/estatisticas/page.tsx`
- Criar testes: `tests/unit/session.test.ts`, `tests/unit/users-store.test.ts`, `tests/unit/analytics-store.test.ts`
- Modificar: `src/components/Header.tsx`, `src/app/admin/page.tsx`, `src/app/api/analyze/route.ts`, `src/app/globals.css`, `.env.example`

---

## Tarefa 1: Sessão HMAC (`session.ts`)

**Arquivos:** Criar `src/lib/session.ts`, `tests/unit/session.test.ts`

- [ ] **Passo 1: Escrever o teste**

`tests/unit/session.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signSession, verifySession } from '@/lib/session';

beforeEach(() => { process.env.SESSION_SECRET = 'segredo-teste'; });
afterEach(() => { delete process.env.SESSION_SECRET; });

describe('session', () => {
  it('assina e verifica o mesmo usuário', async () => {
    const token = await signSession('joao');
    expect(await verifySession(token)).toBe('joao');
  });

  it('rejeita token adulterado', async () => {
    const token = await signSession('joao');
    expect(await verifySession(token + 'x')).toBeNull();
  });

  it('rejeita token vazio ou malformado', async () => {
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession('')).toBeNull();
    expect(await verifySession('semponto')).toBeNull();
  });

  it('preserva usuário com ponto no nome', async () => {
    const token = await signSession('joao.silva');
    expect(await verifySession(token)).toBe('joao.silva');
  });
});
```

- [ ] **Passo 2: Rodar o teste (deve falhar)**

Run: `npm run test -- session`
Expected: FAIL (módulo não existe).

- [ ] **Passo 3: Implementar `src/lib/session.ts`**

```typescript
const encoder = new TextEncoder();

function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || 'emserh-dev-secret';
}

async function hmacHex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Token de sessão: `username.<hmacHex>`. */
export async function signSession(username: string): Promise<string> {
  return `${username}.${await hmacHex(username)}`;
}

/** Retorna o username se o token for válido, senão null. */
export async function verifySession(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return null;
  const username = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = await hmacHex(username);
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? username : null;
}
```

- [ ] **Passo 4: Rodar o teste (deve passar)**

Run: `npm run test -- session`
Expected: PASS (4 testes).

- [ ] **Passo 5: Commit**

```bash
git add src/lib/session.ts tests/unit/session.test.ts
git commit -m "feat: sessao HMAC via Web Crypto (compativel com middleware Edge)"
```

---

## Tarefa 2: Store de usuários (`users-store.ts`)

**Arquivos:** Criar `src/lib/users-store.ts`, `tests/unit/users-store.test.ts`

- [ ] **Passo 1: Escrever o teste**

`tests/unit/users-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  hashPassword, verifyPassword, createUser, listUsers, deleteUser, verifyLogin,
  resetUsersCache, CreateUserSchema,
} from '@/lib/users-store';

let tmpDir: string;
beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'users-'));
  process.env.USERS_STORE_PATH = path.join(tmpDir, 'users.json');
  resetUsersCache();
});
afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  delete process.env.USERS_STORE_PATH;
});

describe('hashPassword / verifyPassword', () => {
  it('gera hash diferente da senha e verifica corretamente', () => {
    const h = hashPassword('minhasenha');
    expect(h).not.toContain('minhasenha');
    expect(verifyPassword('minhasenha', h)).toBe(true);
    expect(verifyPassword('errada', h)).toBe(false);
  });
});

describe('CRUD de usuários', () => {
  it('cria, lista e remove', async () => {
    await createUser('João Silva', 'joao', 'senha123');
    let users = await listUsers();
    expect(users.map((u) => u.username)).toEqual(['joao']);
    expect(users[0]).not.toHaveProperty('passwordHash');
    await deleteUser('joao');
    users = await listUsers();
    expect(users).toEqual([]);
  });

  it('rejeita username duplicado', async () => {
    await createUser('A', 'joao', 'x1234');
    await expect(createUser('B', 'joao', 'y1234')).rejects.toThrow('DUPLICATE');
  });
});

describe('verifyLogin', () => {
  it('aceita credenciais corretas e rejeita as erradas', async () => {
    await createUser('João', 'joao', 'senha123');
    expect(await verifyLogin('joao', 'senha123')).toEqual({ username: 'joao', nome: 'João' });
    expect(await verifyLogin('joao', 'errada')).toBeNull();
    expect(await verifyLogin('naoexiste', 'x')).toBeNull();
  });
});

describe('CreateUserSchema', () => {
  it('valida payload', () => {
    expect(CreateUserSchema.safeParse({ nome: 'A', username: 'joao', senha: '1234' }).success).toBe(true);
    expect(CreateUserSchema.safeParse({ nome: '', username: 'joao', senha: '1234' }).success).toBe(false);
    expect(CreateUserSchema.safeParse({ nome: 'A', username: 'ab', senha: '1234' }).success).toBe(false);
    expect(CreateUserSchema.safeParse({ nome: 'A', username: 'joao', senha: '12' }).success).toBe(false);
  });
});
```

- [ ] **Passo 2: Rodar o teste (deve falhar)**

Run: `npm run test -- users-store`
Expected: FAIL (módulo não existe).

- [ ] **Passo 3: Implementar `src/lib/users-store.ts`**

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';

export interface User {
  username: string;
  nome: string;
  passwordHash: string;
  createdAt: string;
}

export const CreateUserSchema = z.object({
  nome: z.string().min(1),
  username: z.string().min(3).regex(/^[a-zA-Z0-9._-]+$/),
  senha: z.string().min(4),
});

function getUsersPath(): string {
  if (process.env.USERS_STORE_PATH) return process.env.USERS_STORE_PATH;
  const base = process.env.RULES_STORE_PATH
    ? path.dirname(process.env.RULES_STORE_PATH)
    : path.join(process.cwd(), 'data');
  return path.join(base, 'users.json');
}

export function hashPassword(senha: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senha, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(senha: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(senha, salt, 64).toString('hex');
  const a = Buffer.from(test, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

let cache: User[] | null = null;
export function resetUsersCache(): void { cache = null; }

async function readUsers(): Promise<User[]> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(getUsersPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed) ? (parsed as User[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function writeUsers(users: User[]): Promise<void> {
  const p = getUsersPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(users, null, 2), 'utf-8');
  await fs.rename(tmp, p);
  cache = users;
}

export async function listUsers(): Promise<Array<{ username: string; nome: string; createdAt: string }>> {
  const users = await readUsers();
  return users.map((u) => ({ username: u.username, nome: u.nome, createdAt: u.createdAt }));
}

export async function createUser(nome: string, username: string, senha: string): Promise<void> {
  const users = await readUsers();
  if (users.some((u) => u.username === username)) throw new Error('DUPLICATE');
  await writeUsers([
    ...users,
    { username, nome, passwordHash: hashPassword(senha), createdAt: new Date().toISOString() },
  ]);
}

export async function deleteUser(username: string): Promise<void> {
  const users = await readUsers();
  await writeUsers(users.filter((u) => u.username !== username));
}

export async function verifyLogin(username: string, senha: string): Promise<{ username: string; nome: string } | null> {
  const users = await readUsers();
  const u = users.find((x) => x.username === username);
  if (!u || !verifyPassword(senha, u.passwordHash)) return null;
  return { username: u.username, nome: u.nome };
}
```

- [ ] **Passo 4: Rodar o teste (deve passar)**

Run: `npm run test -- users-store`
Expected: PASS (5 testes).

- [ ] **Passo 5: Commit**

```bash
git add src/lib/users-store.ts tests/unit/users-store.test.ts
git commit -m "feat: users-store (scrypt + CRUD de contas em JSON)"
```

---

## Tarefa 3: Rotas de autenticação

**Arquivos:** Criar `src/app/api/auth/login/route.ts`, `.../logout/route.ts`, `.../me/route.ts`

- [ ] **Passo 1: `src/app/api/auth/login/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { verifyLogin } from '@/lib/users-store';
import { signSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const username = typeof body?.username === 'string' ? body.username : '';
  const senha = typeof body?.senha === 'string' ? body.senha : '';

  const user = await verifyLogin(username, senha);
  if (!user) {
    return NextResponse.json({ error: 'Usuário ou senha incorretos' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, nome: user.nome });
  res.cookies.set('session', await signSession(user.username), {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/',
  });
  return res;
}
```

- [ ] **Passo 2: `src/app/api/auth/logout/route.ts`**

```typescript
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('session', '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
```

- [ ] **Passo 3: `src/app/api/auth/me/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';
import { listUsers } from '@/lib/users-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const username = await verifySession(cookieStore.get('session')?.value);
  if (!username) return NextResponse.json({ user: null });
  const u = (await listUsers()).find((x) => x.username === username);
  return NextResponse.json({ user: { username, nome: u?.nome ?? username } });
}
```

- [ ] **Passo 4: Verificar build**

Run: `npm run build`
Expected: PASS; rotas `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` listadas.

- [ ] **Passo 5: Commit**

```bash
git add src/app/api/auth
git commit -m "feat: rotas de autenticacao (login, logout, me)"
```

---

## Tarefa 4: Middleware de proteção (`middleware.ts`)

**Arquivos:** Criar `src/middleware.ts`

- [ ] **Passo 1: Implementar `src/middleware.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from '@/lib/session';

// Caminhos que não exigem login de usuário (admin usa a senha mestra própria).
const PUBLIC_EXACT = ['/login'];
const PUBLIC_PREFIX = ['/api/auth', '/admin', '/api/admin', '/api/health'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  return PUBLIC_PREFIX.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const username = await verifySession(request.cookies.get('session')?.value);
  if (username) return NextResponse.next();

  if (pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = {
  // Aplica a tudo, exceto assets estáticos.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo-emserh.png).*)'],
};
```

- [ ] **Passo 2: Verificar build**

Run: `npm run build`
Expected: PASS (a middleware compila; a rota `ƒ Middleware` pode aparecer na listagem).

- [ ] **Passo 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: middleware exige login em todo o app (exceto login/admin/health)"
```

---

## Tarefa 5: Tela de login

**Arquivos:** Criar `src/app/login/page.tsx`, `src/components/LoginForm.tsx`; Modificar `src/app/globals.css`

- [ ] **Passo 1: `src/components/LoginForm.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, senha }),
    });
    setLoading(false);
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setErro('Usuário ou senha incorretos.');
    }
  }

  return (
    <main className="login-page">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-emserh.png" alt="EMSERH" />
          <div className="login-sub">Auditor de Conformidade · GCIF</div>
        </div>
        <div className="card-body">
          <label className="segment-label" htmlFor="usuario">Usuário</label>
          <input id="usuario" className="admin-input" value={username} autoFocus
            onChange={(e) => setUsername(e.target.value)} />
          <label className="segment-label" htmlFor="senha">Senha</label>
          <input id="senha" type="password" className="admin-input" value={senha}
            onChange={(e) => setSenha(e.target.value)} />
          {erro && <p className="admin-error">{erro}</p>}
          <button className="btn-primary" type="submit" disabled={loading || !username || !senha}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </form>
    </main>
  );
}
```

- [ ] **Passo 2: `src/app/login/page.tsx`**

```typescript
import { LoginForm } from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return <LoginForm />;
}
```

- [ ] **Passo 3: Estilos em `src/app/globals.css`** (antes de `/* ===== Responsive ===== */`)

```css
  /* ===== Login ===== */
  .login-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
  .login-card { width: 100%; max-width: 400px; }
  .login-brand { padding: 26px 26px 0; display: flex; flex-direction: column; gap: 8px; align-items: center; text-align: center; }
  .login-brand img { height: 40px; width: auto; }
  .login-sub { font-size: 12px; color: var(--em-muted); }
  .login-card .card-body { display: flex; flex-direction: column; gap: 6px; padding: 22px 26px 26px; }
  .login-card .segment-label { margin-top: 8px; }
  .login-card .btn-primary { margin-top: 14px; justify-content: center; }
```

- [ ] **Passo 4: Verificar build**

Run: `npm run build`
Expected: PASS; rota `/login` listada.

- [ ] **Passo 5: Commit**

```bash
git add src/app/login/page.tsx src/components/LoginForm.tsx src/app/globals.css
git commit -m "feat: tela de login de usuario"
```

---

## Tarefa 6: Header com usuário logado + Sair

**Arquivos:** Modificar `src/components/Header.tsx`, `src/app/globals.css`

- [ ] **Passo 1: Atualizar `src/components/Header.tsx`**

Substituir o conteúdo inteiro por:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  onLogoClick?: () => void;
  active?: 'analise' | 'regras';
}

export function Header({ onLogoClick, active = 'analise' }: HeaderProps) {
  const [nome, setNome] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let ativo = true;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => { if (ativo) setNome(d?.user?.nome ?? null); })
      .catch(() => {});
    return () => { ativo = false; };
  }, []);

  function handleHome(e: React.MouseEvent) {
    if (onLogoClick) { e.preventDefault(); onLogoClick(); }
  }

  async function sair() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
    router.refresh();
  }

  const iniciais = nome ? nome.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() : '';

  return (
    <header className="header">
      <div className="header-inner">
        <a className="brand" href="/" onClick={handleHome} aria-label="Voltar para a tela inicial">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-emserh.png" alt="EMSERH" />
          <div className="brand-divider" />
          <div className="brand-meta">
            <div className="system">Auditor de Conformidade</div>
            <div className="dept">GCIF · Gerência de Controle Interno Financeiro</div>
          </div>
        </a>
        <div className="header-right">
          <a className={`header-link ${active === 'analise' ? 'active' : ''}`} href="/" onClick={handleHome}>Nova análise</a>
          <a className="header-link" href="#">Histórico</a>
          <a className={`header-link ${active === 'regras' ? 'active' : ''}`} href="/admin">Regras</a>
          {nome && (
            <div className="user-chip">
              <span className="name">{nome}</span>
              <div className="avatar">{iniciais}</div>
              <button className="logout-btn" onClick={sair} title="Sair">Sair</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Passo 2: Estilo do botão Sair em `src/app/globals.css`** (logo após a regra `.user-chip` existente; se não houver `.logout-btn`, adicionar no bloco de login criado na Tarefa 5)

```css
  .logout-btn { margin-left: 10px; background: none; border: 0; color: var(--em-muted); font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; padding: 4px 6px; border-radius: 6px; }
  .logout-btn:hover { color: var(--err); background: var(--err-soft); }
```

- [ ] **Passo 3: Verificar build**

Run: `npm run build`
Expected: PASS.

- [ ] **Passo 4: Commit**

```bash
git add src/components/Header.tsx src/app/globals.css
git commit -m "feat: header exibe usuario logado e botao Sair"
```

---

## Tarefa 7: Gestão de usuários no admin

**Arquivos:** Criar `src/lib/admin-guard.ts`, `src/components/AdminNav.tsx`, `src/components/UsersManager.tsx`, `src/app/admin/usuarios/page.tsx`, `src/app/api/admin/users/route.ts`; Modificar `src/app/admin/page.tsx`, `src/app/globals.css`

- [ ] **Passo 1: `src/lib/admin-guard.ts`**

```typescript
import { cookies } from 'next/headers';
import { verifyAuthToken } from '@/lib/admin-auth';

/** True se a requisição atual tem o cookie de admin válido. */
export async function isAdminAuthed(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyAuthToken(cookieStore.get('admin_auth')?.value);
}
```

- [ ] **Passo 2: `src/components/AdminNav.tsx`**

```typescript
interface AdminNavProps {
  active: 'regras' | 'usuarios' | 'estatisticas';
}

export function AdminNav({ active }: AdminNavProps) {
  const links = [
    { id: 'regras', label: 'Regras', href: '/admin' },
    { id: 'usuarios', label: 'Usuários', href: '/admin/usuarios' },
  ] as const;
  return (
    <nav className="admin-nav">
      {links.map((l) => (
        <a key={l.id} href={l.href} className={`admin-nav-link ${active === l.id ? 'active' : ''}`}>
          {l.label}
        </a>
      ))}
    </nav>
  );
}
```

- [ ] **Passo 3: `src/app/api/admin/users/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/admin-guard';
import { listUsers, createUser, deleteUser, CreateUserSchema } from '@/lib/users-store';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  return NextResponse.json({ users: await listUsers() });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.issues }, { status: 400 });
  try {
    await createUser(parsed.data.nome, parsed.data.username, parsed.data.senha);
  } catch (err) {
    if (err instanceof Error && err.message === 'DUPLICATE') {
      return NextResponse.json({ error: 'Já existe um usuário com esse login' }, { status: 409 });
    }
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'user_create_failed');
    return NextResponse.json({ error: 'Falha ao criar usuário' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  if (!username) return NextResponse.json({ error: 'username ausente' }, { status: 400 });
  await deleteUser(username);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Passo 4: `src/components/UsersManager.tsx`**

```typescript
'use client';

import { useEffect, useState } from 'react';

interface UserRow { username: string; nome: string; createdAt: string; }

export function UsersManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [nome, setNome] = useState('');
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function carregar() {
    const res = await fetch('/api/admin/users');
    if (res.ok) setUsers((await res.json()).users);
  }

  useEffect(() => { carregar(); }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, username, senha }),
    });
    setLoading(false);
    if (res.ok) {
      setNome(''); setUsername(''); setSenha('');
      carregar();
    } else {
      const d = await res.json().catch(() => ({}));
      setErro(d.error ?? 'Falha ao criar usuário.');
    }
  }

  async function remover(u: string) {
    await fetch(`/api/admin/users?username=${encodeURIComponent(u)}`, { method: 'DELETE' });
    carregar();
  }

  return (
    <main className="admin-editor">
      <div className="card">
        <div className="card-head"><div className="card-title">Usuários</div></div>
        <div className="card-body">
          <form className="user-form" onSubmit={criar}>
            <input className="admin-input" placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
            <input className="admin-input" placeholder="Login (usuário)" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input className="admin-input" type="password" placeholder="Senha inicial" value={senha} onChange={(e) => setSenha(e.target.value)} />
            <button className="btn-primary" type="submit" disabled={loading || !nome || !username || !senha}>
              {loading ? 'Criando...' : 'Adicionar usuário'}
            </button>
          </form>
          {erro && <p className="admin-error">{erro}</p>}

          <table className="user-table">
            <thead>
              <tr><th>Nome</th><th>Login</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username}>
                  <td>{u.nome}</td>
                  <td>{u.username}</td>
                  <td><button className="rule-remove" onClick={() => remover(u.username)}>Remover</button></td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={3} className="user-empty">Nenhum usuário cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Passo 5: `src/app/admin/usuarios/page.tsx`**

```typescript
import { Header } from '@/components/Header';
import { AdminLogin } from '@/components/AdminLogin';
import { AdminNav } from '@/components/AdminNav';
import { UsersManager } from '@/components/UsersManager';
import { isAdminAuthed } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function UsuariosPage() {
  if (!(await isAdminAuthed())) {
    return (<><Header active="regras" /><AdminLogin /></>);
  }
  return (
    <>
      <Header active="regras" />
      <AdminNav active="usuarios" />
      <UsersManager />
    </>
  );
}
```

- [ ] **Passo 6: Atualizar `src/app/admin/page.tsx`** — adicionar `AdminNav` e usar o guard compartilhado

```typescript
import { getRulesStore, isPersistenceConfigured } from '@/lib/rules-store';
import { Header } from '@/components/Header';
import { AdminLogin } from '@/components/AdminLogin';
import { AdminNav } from '@/components/AdminNav';
import { RulesEditor } from '@/components/RulesEditor';
import { isAdminAuthed } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!(await isAdminAuthed())) {
    return (<><Header active="regras" /><AdminLogin /></>);
  }
  const store = await getRulesStore();
  return (
    <>
      <Header active="regras" />
      <AdminNav active="regras" />
      <RulesEditor initialStore={store} persistent={isPersistenceConfigured()} />
    </>
  );
}
```

- [ ] **Passo 7: Estilos em `src/app/globals.css`** (antes de `/* ===== Responsive ===== */`)

```css
  /* ===== Admin nav + usuários ===== */
  .admin-nav { width: min(96%, 1600px); margin: 20px auto 0; display: flex; gap: 6px; border-bottom: 1px solid var(--line-2); }
  .admin-nav-link { padding: 10px 16px; font-size: 13.5px; font-weight: 600; color: var(--em-muted); text-decoration: none; border-bottom: 2px solid transparent; margin-bottom: -1px; }
  .admin-nav-link:hover { color: var(--ink-2); }
  .admin-nav-link.active { color: var(--emserh-navy); border-bottom-color: var(--emserh-navy); }
  .user-form { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 10px; align-items: end; margin-bottom: 18px; }
  .user-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .user-table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--em-muted); padding: 8px 10px; border-bottom: 1px solid var(--line-2); }
  .user-table td { padding: 10px; border-bottom: 1px solid var(--line-2); color: var(--ink-2); }
  .user-empty { color: var(--em-muted); text-align: center; padding: 20px; }
  @media (max-width: 720px) { .user-form { grid-template-columns: 1fr; } }
```

- [ ] **Passo 8: Verificar build**

Run: `npm run build`
Expected: PASS; rota `/admin/usuarios` listada.

- [ ] **Passo 9: Commit**

```bash
git add src/lib/admin-guard.ts src/components/AdminNav.tsx src/components/UsersManager.tsx src/app/admin/usuarios/page.tsx src/app/api/admin/users/route.ts src/app/admin/page.tsx src/app/globals.css
git commit -m "feat: gestao de usuarios no admin (criar/listar/remover)"
```

---

## Tarefa 8: Store do contador (`analytics-store.ts`)

**Arquivos:** Criar `src/lib/analytics-store.ts`, `tests/unit/analytics-store.test.ts`

- [ ] **Passo 1: Escrever o teste**

`tests/unit/analytics-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { incrementCount, getAnalytics, resetAnalyticsCache } from '@/lib/analytics-store';

let tmpDir: string;
beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'analytics-'));
  process.env.ANALYTICS_STORE_PATH = path.join(tmpDir, 'analytics.json');
  resetAnalyticsCache();
});
afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  delete process.env.ANALYTICS_STORE_PATH;
});

describe('analytics-store', () => {
  it('acumula por usuário e data', async () => {
    await incrementCount('joao', '2026-05-28');
    await incrementCount('joao', '2026-05-28');
    await incrementCount('maria', '2026-05-28');
    const a = await getAnalytics();
    expect(a['2026-05-28'].joao).toBe(2);
    expect(a['2026-05-28'].maria).toBe(1);
  });

  it('serializa incrementos concorrentes sem perder contagem', async () => {
    await Promise.all([
      incrementCount('joao', '2026-05-28'),
      incrementCount('joao', '2026-05-28'),
      incrementCount('joao', '2026-05-28'),
    ]);
    const a = await getAnalytics();
    expect(a['2026-05-28'].joao).toBe(3);
  });

  it('persiste entre leituras (resetando cache)', async () => {
    await incrementCount('joao', '2026-05-28');
    resetAnalyticsCache();
    const a = await getAnalytics();
    expect(a['2026-05-28'].joao).toBe(1);
  });
});
```

- [ ] **Passo 2: Rodar o teste (deve falhar)**

Run: `npm run test -- analytics-store`
Expected: FAIL (módulo não existe).

- [ ] **Passo 3: Implementar `src/lib/analytics-store.ts`**

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '@/lib/logger';

export type Analytics = { [data: string]: { [username: string]: number } };

function getAnalyticsPath(): string {
  if (process.env.ANALYTICS_STORE_PATH) return process.env.ANALYTICS_STORE_PATH;
  const base = process.env.RULES_STORE_PATH
    ? path.dirname(process.env.RULES_STORE_PATH)
    : path.join(process.cwd(), 'data');
  return path.join(base, 'analytics.json');
}

let cache: Analytics | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export function resetAnalyticsCache(): void {
  cache = null;
  writeQueue = Promise.resolve();
}

async function read(): Promise<Analytics> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(getAnalyticsPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    cache = parsed && typeof parsed === 'object' ? (parsed as Analytics) : {};
  } catch {
    cache = {};
  }
  return cache;
}

async function write(data: Analytics): Promise<void> {
  const p = getAnalyticsPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmp, p);
  cache = data;
}

export async function getAnalytics(): Promise<Analytics> {
  return read();
}

/** Incrementa o contador do usuário na data. Serializado para evitar corrida. */
export function incrementCount(username: string, data: string, by = 1): Promise<void> {
  writeQueue = writeQueue
    .then(async () => {
      const current = await read();
      const next: Analytics = structuredClone(current);
      next[data] = next[data] ?? {};
      next[data][username] = (next[data][username] ?? 0) + by;
      await write(next);
    })
    .catch((err) => {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'analytics_increment_failed');
    });
  return writeQueue;
}
```

- [ ] **Passo 4: Rodar o teste (deve passar)**

Run: `npm run test -- analytics-store`
Expected: PASS (3 testes).

- [ ] **Passo 5: Commit**

```bash
git add src/lib/analytics-store.ts tests/unit/analytics-store.test.ts
git commit -m "feat: analytics-store (contador por usuario/data, gravacao serializada)"
```

---

## Tarefa 9: Integrar o contador no analyze

**Arquivos:** Modificar `src/app/api/analyze/route.ts`

- [ ] **Passo 1: Imports no topo** (após os imports existentes)

```typescript
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';
import { incrementCount } from '@/lib/analytics-store';
```

- [ ] **Passo 2: Ler o usuário logado** — logo após ler `segmento`/`modalidade` do FormData:

```typescript
  const cookieStore = await cookies();
  const username = await verifySession(cookieStore.get('session')?.value);
```

- [ ] **Passo 3: Incrementar após cada arquivo analisado** — dentro do loop, logo após o `results.push({ ... })`:

```typescript
          if (username) {
            const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
            incrementCount(username, hoje).catch(() => { /* contador é secundário */ });
          }
```

- [ ] **Passo 4: Verificar build**

Run: `npm run build`
Expected: PASS.

- [ ] **Passo 5: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: conta 1 analise por PDF concluido para o usuario logado"
```

---

## Tarefa 10: Dashboard de estatísticas

**Arquivos:** Criar `src/app/api/admin/analytics/route.ts`, `src/components/AnalyticsDashboard.tsx`, `src/app/admin/estatisticas/page.tsx`; Modificar `src/components/AdminNav.tsx`, `src/app/globals.css`

- [ ] **Passo 1: `src/app/api/admin/analytics/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/admin-guard';
import { getAnalytics } from '@/lib/analytics-store';
import { listUsers } from '@/lib/users-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const [analytics, users] = await Promise.all([getAnalytics(), listUsers()]);
  const nomes: Record<string, string> = {};
  for (const u of users) nomes[u.username] = u.nome;
  return NextResponse.json({ analytics, nomes });
}
```

- [ ] **Passo 2: `src/components/AnalyticsDashboard.tsx`**

```typescript
'use client';

import { useEffect, useState } from 'react';

type Analytics = { [data: string]: { [username: string]: number } };

export function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<Analytics>({});
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then((r) => r.json())
      .then((d) => { setAnalytics(d.analytics ?? {}); setNomes(d.nomes ?? {}); setCarregado(true); })
      .catch(() => setCarregado(true));
  }, []);

  const datas = Object.keys(analytics).sort().reverse();
  const linhas = datas.map((data) => {
    const porUsuario = analytics[data];
    const total = Object.values(porUsuario).reduce((s, n) => s + n, 0);
    return { data, porUsuario, total };
  });
  const totalGeral = linhas.reduce((s, l) => s + l.total, 0);

  return (
    <main className="admin-editor">
      <div className="card">
        <div className="card-head">
          <div className="card-title">Estatísticas de análises</div>
          <span style={{ fontSize: '12px', color: 'var(--em-muted)' }}>Total geral: <strong>{totalGeral}</strong></span>
        </div>
        <div className="card-body">
          {!carregado && <p className="user-empty">Carregando...</p>}
          {carregado && linhas.length === 0 && <p className="user-empty">Nenhuma análise registrada ainda.</p>}
          {linhas.map((l) => (
            <div key={l.data} className="stat-day">
              <div className="stat-day-head">
                <span className="stat-day-date">{l.data.split('-').reverse().join('/')}</span>
                <span className="stat-day-total">{l.total} análise(s)</span>
              </div>
              <div className="stat-users">
                {Object.entries(l.porUsuario).sort((a, b) => b[1] - a[1]).map(([u, n]) => (
                  <div key={u} className="stat-user-row">
                    <span>{nomes[u] ?? u}</span>
                    <span className="stat-user-count">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Passo 3: `src/app/admin/estatisticas/page.tsx`**

```typescript
import { Header } from '@/components/Header';
import { AdminLogin } from '@/components/AdminLogin';
import { AdminNav } from '@/components/AdminNav';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { isAdminAuthed } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function EstatisticasPage() {
  if (!(await isAdminAuthed())) {
    return (<><Header active="regras" /><AdminLogin /></>);
  }
  return (
    <>
      <Header active="regras" />
      <AdminNav active="estatisticas" />
      <AnalyticsDashboard />
    </>
  );
}
```

- [ ] **Passo 4: Adicionar o link em `src/components/AdminNav.tsx`** — atualizar o array `links`:

```typescript
  const links = [
    { id: 'regras', label: 'Regras', href: '/admin' },
    { id: 'usuarios', label: 'Usuários', href: '/admin/usuarios' },
    { id: 'estatisticas', label: 'Estatísticas', href: '/admin/estatisticas' },
  ] as const;
```

- [ ] **Passo 5: Estilos em `src/app/globals.css`** (antes de `/* ===== Responsive ===== */`)

```css
  /* ===== Estatísticas ===== */
  .stat-day { border: 1px solid var(--line-2); border-radius: 10px; margin-bottom: 12px; overflow: hidden; }
  .stat-day-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: var(--paper-soft); }
  .stat-day-date { font-weight: 700; color: var(--emserh-navy); font-size: 13.5px; }
  .stat-day-total { font-size: 12px; color: var(--em-muted); }
  .stat-users { padding: 4px 16px 10px; }
  .stat-user-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: var(--ink-2); border-bottom: 1px solid var(--line-2); }
  .stat-user-row:last-child { border-bottom: 0; }
  .stat-user-count { font-family: var(--font-jetbrains-mono, monospace); font-weight: 600; color: var(--ink); }
```

- [ ] **Passo 6: Verificar build**

Run: `npm run build`
Expected: PASS; rota `/admin/estatisticas` listada.

- [ ] **Passo 7: Commit**

```bash
git add src/app/api/admin/analytics/route.ts src/components/AnalyticsDashboard.tsx src/app/admin/estatisticas/page.tsx src/components/AdminNav.tsx src/app/globals.css
git commit -m "feat: dashboard de estatisticas de analises por usuario/data"
```

---

## Tarefa 11: Env + verificação final + push

**Arquivos:** Modificar `.env.example`

- [ ] **Passo 1: Atualizar `.env.example`** (ao final)

```
# Sessão de login (assinatura do cookie). Se vazio, usa ADMIN_PASSWORD.
SESSION_SECRET=troque-por-um-segredo-aleatorio
# Opcional: caminhos dos stores de contas e contador (padrão: mesmo diretório de RULES_STORE_PATH)
USERS_STORE_PATH=
ANALYTICS_STORE_PATH=
```

- [ ] **Passo 2: Build limpo**

Run: `npm run build`
Expected: build completa; rotas `/login`, `/admin/usuarios`, `/admin/estatisticas`, `/api/auth/*`, `/api/admin/users`, `/api/admin/analytics` e a Middleware listadas.

- [ ] **Passo 3: Suíte completa**

Run: `npm run test`
Expected: PASS em todos (session, users-store, analytics-store e os pré-existentes).

- [ ] **Passo 4: Commit + push**

```bash
git add .env.example
git commit -m "chore: env para login/contador (SESSION_SECRET, USERS/ANALYTICS_STORE_PATH)"
git push
```

- [ ] **Passo 5: Instrução ao usuário (Railway)**

Informar que, além do volume `/data` + `RULES_STORE_PATH=/data/rules.json` já necessários, é recomendável definir `SESSION_SECRET` (um valor aleatório) no Railway. Sem volume, contas e contador somem no deploy. O primeiro acesso: o admin entra em `/admin` (senha mestra) → aba **Usuários** → cria as contas; os usuários passam a logar em `/login`.

---

## Auto-revisão (autor do plano)

**Cobertura do spec:**
- Login real (usuário+senha, contas do admin) → Tarefas 2, 3, 5, 7 ✅
- Login obrigatório em todo o app → Tarefa 4 (middleware) ✅
- Sessão HMAC compatível com Edge → Tarefa 1 ✅
- Header com usuário + Sair → Tarefa 6 ✅
- Contador por usuário/data (1 por PDF) → Tarefas 8, 9 ✅
- Dashboard → Tarefa 10 ✅
- Armazenamento JSON no volume, com fallback → Tarefas 2, 8 ✅
- Env/infra → Tarefa 11 ✅

**Consistência de tipos/assinaturas:**
- `signSession`/`verifySession` (T1) usados em T3, T4, T9 ✅
- `verifyLogin`, `createUser`, `listUsers`, `deleteUser`, `CreateUserSchema`, `resetUsersCache` (T2) usados em T3, T7 ✅
- `isAdminAuthed` (T7) usado em T7 e T10 ✅
- `incrementCount`, `getAnalytics`, `resetAnalyticsCache` (T8) usados em T9, T10 ✅
- `AdminNav active` aceita `'regras'|'usuarios'|'estatisticas'` (T7/T10) ✅
- `Header` mantém props `onLogoClick`/`active` (T6), compatível com uso em page.tsx e nas páginas admin ✅

**Riscos conhecidos:**
- Middleware roda no Edge → sessão usa Web Crypto (T1), não `node:crypto`. Senhas usam `node:crypto` scrypt apenas nas rotas (Node). ✅
- `cookies()` assíncrono no Next 16 → tratado com `await` em T3, T7, T9. O build valida.
