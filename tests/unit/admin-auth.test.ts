import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkPassword, makeAuthToken, verifyAuthToken } from '@/lib/admin-auth';

beforeEach(() => { process.env.ADMIN_PASSWORD = 'senha-secreta'; });
afterEach(() => { delete process.env.ADMIN_PASSWORD; });

describe('checkPassword', () => {
  it('aceita a senha correta e rejeita a errada', () => {
    expect(checkPassword('senha-secreta')).toBe(true);
    expect(checkPassword('errada')).toBe(false);
  });

  it('rejeita tudo quando ADMIN_PASSWORD não está definida', () => {
    delete process.env.ADMIN_PASSWORD;
    expect(checkPassword('qualquer')).toBe(false);
  });
});

describe('token de autenticação', () => {
  it('gera token estável e verifica corretamente', () => {
    const token = makeAuthToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyAuthToken(token)).toBe(true);
  });

  it('rejeita token inválido ou ausente', () => {
    expect(verifyAuthToken('token-falso')).toBe(false);
    expect(verifyAuthToken(undefined)).toBe(false);
    expect(verifyAuthToken('')).toBe(false);
  });
});
