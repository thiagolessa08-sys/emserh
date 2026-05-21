import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const mistralKey = process.env.MISTRAL_API_KEY;

  const status = {
    ok: true,
    env: {
      ANTHROPIC_API_KEY: anthropicKey ? `configurada (${anthropicKey.slice(0, 10)}...)` : 'AUSENTE',
      MISTRAL_API_KEY: mistralKey ? `configurada (${mistralKey.slice(0, 8)}...)` : 'AUSENTE',
    },
  };

  return NextResponse.json(status);
}
