import crypto from 'node:crypto';

const TOKEN_SUBJECT = 'emserh-admin-v1';

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Compara a senha informada com ADMIN_PASSWORD (tempo constante). */
export function checkPassword(pwd: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(pwd, expected);
}

/** Token de sessão = HMAC-SHA256(TOKEN_SUBJECT) usando ADMIN_PASSWORD como chave. */
export function makeAuthToken(): string {
  const secret = process.env.ADMIN_PASSWORD ?? '';
  return crypto.createHmac('sha256', secret).update(TOKEN_SUBJECT).digest('hex');
}

/** Verifica se o token do cookie corresponde ao token esperado. */
export function verifyAuthToken(token: string | undefined | null): boolean {
  if (!token) return false;
  if (!process.env.ADMIN_PASSWORD) return false;
  return safeEqual(token, makeAuthToken());
}
