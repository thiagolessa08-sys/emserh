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
