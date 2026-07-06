import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
} from '@react-pdf/renderer';
import type { AnalysisResult, ChecklistItemStatus } from '@/lib/types';
import { recomputeConclusao, type Dispensa, type Secao } from '@/lib/dispensation';

Font.register({
  family: 'Helvetica',
  fonts: [],
});

const STATUS_LABEL: Record<ChecklistItemStatus, string> = {
  CONFORME: 'CONFORME',
  NAO_CONFORME: 'NÃO CONFORME',
  ATENCAO: 'ATENÇÃO',
};

const STATUS_COLOR: Record<ChecklistItemStatus, string> = {
  CONFORME: '#16a34a',
  NAO_CONFORME: '#dc2626',
  ATENCAO: '#d97706',
};

const DECISAO_COLOR: Record<string, string> = {
  CONFORME: '#16a34a',
  NAO_CONFORME: '#dc2626',
  PENDENTE_AJUSTES: '#d97706',
};

const s = StyleSheet.create({
  page: { fontSize: 9, fontFamily: 'Helvetica', padding: 40, color: '#1a1a1a' },
  header: { marginBottom: 16, borderBottomWidth: 2, borderBottomColor: '#1e3a5f', paddingBottom: 8 },
  title: { fontSize: 14, fontWeight: 'bold', color: '#1e3a5f', marginBottom: 2 },
  subtitle: { fontSize: 9, color: '#555' },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1e3a5f',
    backgroundColor: '#e8f0fa',
    padding: 5,
    marginTop: 12,
    marginBottom: 6,
  },
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { width: 130, color: '#555', fontWeight: 'bold' },
  value: { flex: 1 },
  checklistRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
    paddingVertical: 4,
    alignItems: 'flex-start',
  },
  checklistNum: { width: 20, color: '#555' },
  checklistDesc: { flex: 1, paddingRight: 4 },
  statusBadge: {
    width: 72,
    fontSize: 7,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 2,
    borderRadius: 3,
    color: '#fff',
  },
  pendencias: { marginTop: 4, paddingLeft: 8 },
  pendenciaItem: { marginBottom: 2, color: '#dc2626' },
  conclusaoBox: {
    marginTop: 12,
    padding: 10,
    borderWidth: 1.5,
    borderRadius: 4,
  },
  decisaoText: { fontSize: 13, fontWeight: 'bold', marginBottom: 4 },
  resumo: { fontSize: 9, color: '#333' },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40 },
  footerText: { fontSize: 7, color: '#aaa', textAlign: 'center' },
  totaisRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  totaisBox: { flex: 1, padding: 6, borderRadius: 3, alignItems: 'center' },
  totaisNum: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  totaisLabel: { fontSize: 7, color: '#fff', marginTop: 1 },
});

function ChecklistSection({
  title,
  secao,
  items,
  dispensas,
}: {
  title: string;
  secao: Secao;
  items: Array<{ item: number; descricao: string; status: ChecklistItemStatus; motivo: string | null; sugestao_correcao: string | null; data_validade?: string | null }>;
  dispensas: Dispensa[];
}) {
  return (
    <View>
      <Text style={s.sectionTitle}>{title}</Text>
      {items.map((it) => {
        const disp = dispensas.find((d) => d.secao === secao && d.item === it.item && it.status === 'NAO_CONFORME');
        return (
          <View key={it.item} style={s.checklistRow}>
            <Text style={s.checklistNum}>{it.item}.</Text>
            <View style={s.checklistDesc}>
              <Text>{it.descricao}</Text>
              {it.data_validade && (
                <Text style={{ color: '#1e3a5f', fontSize: 8, marginTop: 1, fontWeight: 'bold' }}>Válido até: {it.data_validade}</Text>
              )}
              {disp ? (
                <Text style={{ color: '#1e3a5f', fontSize: 8, marginTop: 1 }}>
                  Dispensado por {disp.auditorNome || 'auditor'}{disp.dataISO ? ` em ${new Date(disp.dataISO).toLocaleDateString('pt-BR')}` : ''} — {disp.justificativa}
                </Text>
              ) : (
                <>
                  {it.motivo && <Text style={{ color: '#666', fontSize: 8, marginTop: 1 }}>{it.motivo}</Text>}
                  {it.sugestao_correcao && <Text style={{ color: '#c2410c', fontSize: 8, marginTop: 1 }}>► {it.sugestao_correcao}</Text>}
                </>
              )}
            </View>
            <Text style={[s.statusBadge, { backgroundColor: disp ? '#1e3a5f' : STATUS_COLOR[it.status] }]}>
              {disp ? 'DISPENSADO' : STATUS_LABEL[it.status]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ConformityDocument({ analysis, dispensas }: { analysis: AnalysisResult; dispensas: Dispensa[] }) {
  const { identificacao_contrato: id, regularidade_fiscal_trabalhista: reg, instrucao_processual: inst, conclusao } = analysis;
  const recalc = recomputeConclusao(analysis, dispensas);
  const decisaoColor = DECISAO_COLOR[recalc.decisao] ?? '#555';

  return (
    <Document title="Relatório de Conformidade — EMSERH" author="GCIF/EMSERH">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>RELATÓRIO DE CONFORMIDADE</Text>
          <Text style={s.subtitle}>EMSERH — Empresa Maranhense de Serviços Hospitalares | GCIF — Gerência de Controle Interno Financeiro</Text>
        </View>

        <Text style={s.sectionTitle}>1. IDENTIFICAÇÃO DO PROCESSO</Text>
        {[
          ['Credor', id.credor], ['CNPJ', id.cnpj], ['Contrato', id.contrato_numero], ['Objeto', id.objeto],
          ['Período', id.periodo_referencia], ['Processo SEI', id.processo_sei], ['Valor Total', id.valor_total],
        ].map(([label, value]) => (
          <View key={label} style={s.row}><Text style={s.label}>{label}:</Text><Text style={s.value}>{value}</Text></View>
        ))}

        <ChecklistSection title="2. REGULARIDADE FISCAL E TRABALHISTA (Itens 1–7)" secao="reg" items={reg} dispensas={dispensas} />
        <ChecklistSection title="3. INSTRUÇÃO PROCESSUAL (Itens 8–15)" secao="inst" items={inst} dispensas={dispensas} />

        <View style={[s.conclusaoBox, { borderColor: decisaoColor }]}>
          <Text style={[s.decisaoText, { color: decisaoColor }]}>DECISÃO: {recalc.decisao.replace('_', ' ')}</Text>
          <Text style={s.resumo}>{conclusao.resumo}</Text>
          <View style={s.totaisRow}>
            <View style={[s.totaisBox, { backgroundColor: '#16a34a' }]}><Text style={s.totaisNum}>{recalc.conformes}</Text><Text style={s.totaisLabel}>Conformes</Text></View>
            <View style={[s.totaisBox, { backgroundColor: '#dc2626' }]}><Text style={s.totaisNum}>{recalc.naoConformes}</Text><Text style={s.totaisLabel}>Não Conformes</Text></View>
            <View style={[s.totaisBox, { backgroundColor: '#d97706' }]}><Text style={s.totaisNum}>{recalc.atencao}</Text><Text style={s.totaisLabel}>Atenção</Text></View>
            <View style={[s.totaisBox, { backgroundColor: '#1e3a5f' }]}><Text style={s.totaisNum}>{recalc.dispensados}</Text><Text style={s.totaisLabel}>Dispensados</Text></View>
          </View>
        </View>

        {dispensas.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>4. EXCEÇÕES APLICADAS NESTA ANÁLISE</Text>
            {dispensas.map((d, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 8.5, color: '#1e3a5f', fontWeight: 'bold' }}>
                  {d.secao === 'reg' ? 'Regularidade' : 'Instrução'} — item {d.item} · dispensado por {d.auditorNome || 'auditor'}{d.dataISO ? ` em ${new Date(d.dataISO).toLocaleDateString('pt-BR')}` : ''}
                </Text>
                <Text style={{ fontSize: 8, color: '#333' }}>Justificativa: {d.justificativa}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Documento gerado automaticamente pelo Sistema de Auditoria EMSERH — GCIF | Base legal: Lei 13.303/2016, Portaria 439/2024-GAB/EMSERH, Portaria 279/2025-GAB/EMSERH</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateConformityReport(analysis: AnalysisResult, dispensas: Dispensa[] = []): Promise<Buffer> {
  const uint8 = await renderToBuffer(<ConformityDocument analysis={analysis} dispensas={dispensas} />);
  return Buffer.from(uint8);
}
