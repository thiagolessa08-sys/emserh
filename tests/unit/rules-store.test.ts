import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  mergeWithDefaults,
  getRulesStore,
  saveCombination,
  resetRulesCache,
  isPersistenceConfigured,
  CombinationPayloadSchema,
} from '@/lib/rules-store';
import { DEFAULT_RULES } from '@/lib/default-rules';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rules-'));
  process.env.RULES_STORE_PATH = path.join(tmpDir, 'rules.json');
  resetRulesCache();
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  delete process.env.RULES_STORE_PATH;
});

describe('mergeWithDefaults', () => {
  it('usa override válido e mantém default nas demais combinações', () => {
    const custom = { regularidade: [{ descricao: 'X', detalhe: 'Y' }], instrucao: [] };
    const merged = mergeWithDefaults({ fornecedor: { contrato: custom } });
    expect(merged.fornecedor.contrato).toEqual(custom);
    expect(merged.engenharia.contrato).toEqual(DEFAULT_RULES.engenharia.contrato);
  });

  it('ignora combinação inválida e cai no default', () => {
    const merged = mergeWithDefaults({ fornecedor: { contrato: { lixo: true } } });
    expect(merged.fornecedor.contrato).toEqual(DEFAULT_RULES.fornecedor.contrato);
  });
});

describe('getRulesStore + saveCombination', () => {
  it('faz seed do arquivo quando ausente', async () => {
    const store = await getRulesStore();
    expect(store.fornecedor.contrato).toEqual(DEFAULT_RULES.fornecedor.contrato);
    const onDisk = await fs.readFile(process.env.RULES_STORE_PATH!, 'utf-8');
    expect(JSON.parse(onDisk)).toHaveProperty('fornecedor');
  });

  it('persiste e relê uma combinação salva', async () => {
    const novo = { regularidade: [{ descricao: 'Novo', detalhe: 'Detalhe' }], instrucao: [] };
    await saveCombination('fornecedor', 'contrato', novo);
    resetRulesCache();
    const store = await getRulesStore();
    expect(store.fornecedor.contrato).toEqual(novo);
  });
});

describe('isPersistenceConfigured', () => {
  it('true quando RULES_STORE_PATH está definido', () => {
    process.env.RULES_STORE_PATH = '/data/rules.json';
    expect(isPersistenceConfigured()).toBe(true);
  });

  it('false quando RULES_STORE_PATH não está definido', () => {
    delete process.env.RULES_STORE_PATH;
    expect(isPersistenceConfigured()).toBe(false);
  });
});

describe('CombinationPayloadSchema', () => {
  it('aceita payload válido', () => {
    const r = CombinationPayloadSchema.safeParse({
      segmento: 'fornecedor', modalidade: 'contrato',
      checklist: { regularidade: [{ descricao: 'A', detalhe: 'B' }], instrucao: [] },
    });
    expect(r.success).toBe(true);
  });

  it('rejeita item sem descrição', () => {
    const r = CombinationPayloadSchema.safeParse({
      segmento: 'fornecedor', modalidade: 'contrato',
      checklist: { regularidade: [{ descricao: '', detalhe: 'B' }], instrucao: [] },
    });
    expect(r.success).toBe(false);
  });
});
