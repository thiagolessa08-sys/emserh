import crypto from 'node:crypto';

export type AdminArea = 'regras' | 'usuarios' | 'estatisticas';

const AREAS: Record<AdminArea, { env: string; cookie: string; subject: string }> = {
  regras:       { env: 'ADMIN_PASSWORD',        cookie: 'admin_regras',        subject: 'emserh-admin-regras-v1' },
  usuarios:     { env: 'USERS_ADMIN_PASSWORD',  cookie: 'admin_usuarios',      subject: 'emserh-admin-usuarios-v1' },
  estatisticas: { env: 'STATS_ADMIN_PASSWORD',  cookie: 'admin_estatisticas',  subject: 'emserh-admin-estatisticas-v1' },
};

/** Nome do cookie de sessão de uma área. */
export function adminCookieName(area: AdminArea): string {
  return AREAS[area].cookie;
}

/**
 * Senha da área. Se a variável específica não estiver definida, usa
 * ADMIN_PASSWORD como fallback (evita travar o acesso). Ao definir a senha
 * específica, só ela passa a valer para aquela área.
 */
function areaPassword(area: AdminArea): string | undefined {
  return process.env[AREAS[area].env] || process.env.ADMIN_PASSWORD;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Compara a senha informada com a senha da área (tempo constante). */
export function checkPassword(area: AdminArea, pwd: string): boolean {
  const expected = areaPassword(area);
  if (!expected) return false;
  return safeEqual(pwd, expected);
}

/** Token de sessão = HMAC-SHA256(subject da área) usando a senha da área como chave. */
export function makeAuthToken(area: AdminArea): string {
  const secret = areaPassword(area) ?? '';
  return crypto.createHmac('sha256', secret).update(AREAS[area].subject).digest('hex');
}

/** Verifica se o token do cookie corresponde ao token esperado da área. */
export function verifyAuthToken(area: AdminArea, token: string | undefined | null): boolean {
  if (!token) return false;
  if (!areaPassword(area)) return false;
  return safeEqual(token, makeAuthToken(area));
}
