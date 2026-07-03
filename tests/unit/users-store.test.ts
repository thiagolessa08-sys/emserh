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

const base = {
  nome: 'João Silva', email: 'joao@emserh.ma.gov.br', cpf: '12345678901',
  matricula: '45.981-2', telefone: '(98) 90000-0000', unidade: 'GCIF',
  cargo: 'Auditor de Controle Interno', role: 'Auditor' as const, senha: 'senha123',
};

describe('hashPassword / verifyPassword', () => {
  it('gera hash diferente da senha e verifica corretamente', () => {
    const h = hashPassword('minhasenha');
    expect(h).not.toContain('minhasenha');
    expect(verifyPassword('minhasenha', h)).toBe(true);
    expect(verifyPassword('errada', h)).toBe(false);
  });
});

describe('CRUD de usuários', () => {
  it('cria, lista (sem hash) e remove por email', async () => {
    await createUser(base);
    let users = await listUsers();
    expect(users.map((u) => u.email)).toEqual(['joao@emserh.ma.gov.br']);
    expect(users[0]).not.toHaveProperty('passwordHash');
    expect(users[0].unidade).toBe('GCIF');
    expect(users[0].role).toBe('Auditor');
    await deleteUser('joao@emserh.ma.gov.br');
    users = await listUsers();
    expect(users).toEqual([]);
  });

  it('rejeita email duplicado', async () => {
    await createUser(base);
    await expect(createUser({ ...base, nome: 'Outro' })).rejects.toThrow('DUPLICATE');
  });
});

describe('verifyLogin (por email)', () => {
  it('aceita credenciais corretas e rejeita as erradas', async () => {
    await createUser(base);
    expect(await verifyLogin('joao@emserh.ma.gov.br', 'senha123')).toEqual({ email: 'joao@emserh.ma.gov.br', nome: 'João Silva' });
    expect(await verifyLogin('joao@emserh.ma.gov.br', 'errada')).toBeNull();
    expect(await verifyLogin('naoexiste@x.com', 'x')).toBeNull();
  });
});

describe('CreateUserSchema', () => {
  it('valida payload', () => {
    expect(CreateUserSchema.safeParse(base).success).toBe(true);
    expect(CreateUserSchema.safeParse({ ...base, email: 'invalido' }).success).toBe(false);
    expect(CreateUserSchema.safeParse({ ...base, nome: '' }).success).toBe(false);
    expect(CreateUserSchema.safeParse({ ...base, senha: '12' }).success).toBe(false);
    expect(CreateUserSchema.safeParse({ ...base, unidade: '' }).success).toBe(false);
  });
});
