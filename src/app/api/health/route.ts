import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Valida a MISTRAL_API_KEY consultando a API (GET /v1/models).
 * Só roda com ?check=mistral para não chamar a Mistral em todo healthcheck.
 */
async function checkMistral(key: string) {
  try {
    const res = await fetch('https://api.mistral.ai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body = res.ok ? '' : (await res.text()).slice(0, 300);
    return {
      status: res.status,
      valida: res.ok,
      rateLimit: {
        limit: res.headers.get('x-ratelimit-limit-req-minute') ?? res.headers.get('ratelimitbysize-limit'),
        remaining: res.headers.get('x-ratelimit-remaining-req-minute') ?? res.headers.get('ratelimitbysize-remaining'),
      },
      ...(body ? { erro: body } : {}),
    };
  } catch (err) {
    return { valida: false, erro: String(err) };
  }
}

export async function GET(req: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const mistralKey = process.env.MISTRAL_API_KEY;

  const status: Record<string, unknown> = {
    ok: true,
    env: {
      ANTHROPIC_API_KEY: anthropicKey ? `configurada (${anthropicKey.slice(0, 10)}...)` : 'AUSENTE',
      MISTRAL_API_KEY: mistralKey
        ? `configurada (${mistralKey.slice(0, 8)}...${mistralKey.slice(-4)})`
        : 'AUSENTE',
    },
  };

  if (mistralKey && req.nextUrl.searchParams.get('check') === 'mistral') {
    status.mistral = await checkMistral(mistralKey);
  }

  return NextResponse.json(status);
}
