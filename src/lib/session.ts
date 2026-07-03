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
