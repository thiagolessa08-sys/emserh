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
