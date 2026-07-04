import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';

export type UserRole = 'Auditor' | 'Consulta' | 'Administrador';

export interface User {
  email: string; // login
  nome: string;
  cpf: string;
  matricula: string;
  telefone: string;
  unidade: string;
  cargo: string;
  role: UserRole;
  passwordHash: string;
  createdAt: string;
}

export type PublicUser = Omit<User, 'passwordHash'>;

export const CreateUserSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  cpf: z.string().min(1),
  matricula: z.string().min(1),
  telefone: z.string().optional().default(''),
  unidade: z.string().min(1),
  cargo: z.string().optional().default(''),
  role: z.enum(['Auditor', 'Consulta', 'Administrador']).default('Auditor'),
  senha: z.string().min(4),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const ResetPasswordSchema = z.object({
  email: z.string().email(),
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
    // Descarta registros em formato antigo (sem email) para não quebrar o código novo.
    cache = Array.isArray(parsed)
      ? (parsed as User[]).filter((u) => u && typeof u.email === 'string' && u.email.length > 0)
      : [];
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

export async function listUsers(): Promise<PublicUser[]> {
  const users = await readUsers();
  return users.map(({ passwordHash: _hash, ...pub }) => pub);
}

export async function createUser(input: CreateUserInput): Promise<void> {
  const users = await readUsers();
  const email = input.email.toLowerCase();
  if (users.some((u) => u.email.toLowerCase() === email)) throw new Error('DUPLICATE');
  await writeUsers([
    ...users,
    {
      email,
      nome: input.nome,
      cpf: input.cpf,
      matricula: input.matricula,
      telefone: input.telefone ?? '',
      unidade: input.unidade,
      cargo: input.cargo ?? '',
      role: input.role,
      passwordHash: hashPassword(input.senha),
      createdAt: new Date().toISOString(),
    },
  ]);
}

export async function setPassword(email: string, senha: string): Promise<void> {
  const users = await readUsers();
  const target = email.toLowerCase();
  const idx = users.findIndex((u) => u.email.toLowerCase() === target);
  if (idx === -1) throw new Error('NOT_FOUND');
  const hash = hashPassword(senha);
  await writeUsers(users.map((u, i) => (i === idx ? { ...u, passwordHash: hash } : u)));
}

export async function deleteUser(email: string): Promise<void> {
  const users = await readUsers();
  const target = email.toLowerCase();
  await writeUsers(users.filter((u) => u.email.toLowerCase() !== target));
}

export async function verifyLogin(email: string, senha: string): Promise<{ email: string; nome: string } | null> {
  const users = await readUsers();
  const target = email.toLowerCase();
  const u = users.find((x) => x.email.toLowerCase() === target);
  if (!u || !verifyPassword(senha, u.passwordHash)) return null;
  return { email: u.email, nome: u.nome };
}
