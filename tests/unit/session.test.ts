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
