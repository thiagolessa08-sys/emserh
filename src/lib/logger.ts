import pino from 'pino';

const SENSITIVE_KEYS = ['paciente', 'cpf', 'cns', 'dn', 'nome_paciente', 'rg'];

export function sanitize<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const clean: Partial<T> = {};
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (!SENSITIVE_KEYS.includes(String(key).toLowerCase())) {
      clean[key] = obj[key];
    }
  }
  return clean;
}

export function createLogger(context: Record<string, unknown> = {}) {
  return pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: context,
    formatters: {
      log: (object) => sanitize(object) as Record<string, unknown>,
    },
  });
}

export const logger = createLogger({ app: 'emserh-auditor' });
