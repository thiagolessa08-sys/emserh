import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkPassword, makeAuthToken, verifyAuthToken, adminCookieName } from '@/lib/admin-auth';

beforeEach(() => {
  process.env.ADMIN_PASSWORD = 'senha-regras';
  process.env.USERS_ADMIN_PASSWORD = 'senha-usuarios';
  process.env.STATS_ADMIN_PASSWORD = 'senha-estatisticas';
});
afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
  delete process.env.USERS_ADMIN_PASSWORD;
  delete process.env.STATS_ADMIN_PASSWORD;
});

describe('checkPassword por área', () => {
  it('cada área aceita apenas a própria senha', () => {
    expect(checkPassword('regras', 'senha-regras')).toBe(true);
    expect(checkPassword('regras', 'senha-usuarios')).toBe(false);
    expect(checkPassword('usuarios', 'senha-usuarios')).toBe(true);
    expect(checkPassword('usuarios', 'senha-regras')).toBe(false);
    expect(checkPassword('estatisticas', 'senha-estatisticas')).toBe(true);
  });

  it('usa ADMIN_PASSWORD como fallback quando a específica não está definida', () => {
    delete process.env.USERS_ADMIN_PASSWORD;
    expect(checkPassword('usuarios', 'senha-regras')).toBe(true);
  });
});

describe('tokens por área', () => {
  it('token de uma área não vale para outra', () => {
    const tokenRegras = makeAuthToken('regras');
    expect(verifyAuthToken('regras', tokenRegras)).toBe(true);
    expect(verifyAuthToken('usuarios', tokenRegras)).toBe(false);
  });

  it('rejeita token ausente', () => {
    expect(verifyAuthToken('regras', undefined)).toBe(false);
    expect(verifyAuthToken('regras', '')).toBe(false);
  });
});

describe('adminCookieName', () => {
  it('cada área tem um cookie distinto', () => {
    const nomes = [adminCookieName('regras'), adminCookieName('usuarios'), adminCookieName('estatisticas')];
    expect(new Set(nomes).size).toBe(3);
  });
});
