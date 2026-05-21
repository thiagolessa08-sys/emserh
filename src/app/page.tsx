'use client';

import { useState } from 'react';
import { UploadArea } from '@/components/UploadArea';
import { ProgressIndicator, type AnalysisStage } from '@/components/ProgressIndicator';
import { ResultPanel } from '@/components/ResultPanel';
import type { AnalysisResult } from '@/lib/types';

interface AnalysisResultEntry {
  filename: string;
  analysis: AnalysisResult;
  reportPdfBase64: string;
  annotatedPdfBase64: string;
}

export default function Home() {
  const [stage, setStage] = useState<AnalysisStage>('idle');
  const [currentFile, setCurrentFile] = useState<string | undefined>();
  const [results, setResults] = useState<AnalysisResultEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleFilesSelected(files: File[]) {
    setResults([]);
    setError(null);

    const formData = new FormData();
    for (const f of files) formData.append('files', f);

    setCurrentFile(files.length === 1 ? files[0].name : `${files.length} arquivos`);
    setStage('extracting');

    try {
      // Simula as fases de progresso enquanto a requisição processa
      const stageTimeout1 = setTimeout(() => setStage('ocr'), 3000);
      const stageTimeout2 = setTimeout(() => setStage('analyzing'), 8000);
      const stageTimeout3 = setTimeout(() => setStage('generating'), 30000);

      const res = await fetch('/api/analyze', { method: 'POST', body: formData });

      clearTimeout(stageTimeout1);
      clearTimeout(stageTimeout2);
      clearTimeout(stageTimeout3);

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? `Erro ${res.status}`);
      }

      const data = await res.json();
      setResults(
        data.results.map(
          (r: { filename: string; analysis: AnalysisResult; reportPdf: string; annotatedPdf: string }) => ({
            filename: r.filename,
            analysis: r.analysis,
            reportPdfBase64: r.reportPdf,
            annotatedPdfBase64: r.annotatedPdf,
          }),
        ),
      );
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage('error');
    }
  }

  const isProcessing = stage !== 'idle' && stage !== 'done' && stage !== 'error';

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white px-6 py-4 shadow-md">
        <div className="mx-auto max-w-4xl flex items-center gap-3">
          <div className="text-3xl">🏥</div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Auditor de Conformidade</h1>
            <p className="text-xs opacity-70">
              EMSERH — GCIF · Gerência de Controle Interno Financeiro
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        {/* Upload */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-700">
            Carregue o(s) processo(s) de pagamento em PDF
          </h2>
          <UploadArea onFilesSelected={handleFilesSelected} disabled={isProcessing} />
        </section>

        {/* Progresso */}
        {stage !== 'idle' && (
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
            <ProgressIndicator stage={stage} filename={currentFile} />
            {stage === 'error' && error && (
              <p className="mt-3 text-sm text-red-600 text-center">{error}</p>
            )}
          </section>
        )}

        {/* Resultados */}
        {results.map((r) => (
          <ResultPanel
            key={r.filename}
            filename={r.filename}
            analysis={r.analysis}
            reportPdfBase64={r.reportPdfBase64}
            annotatedPdfBase64={r.annotatedPdfBase64}
          />
        ))}
      </div>
    </main>
  );
}
