'use client';

import { useState, useEffect, useRef } from 'react';
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

type SSEEvent =
  | { type: 'progress'; stage: AnalysisStage; message: string }
  | { type: 'result'; results: Array<{ filename: string; analysis: AnalysisResult; reportPdf: string; annotatedPdf: string }> }
  | { type: 'error'; message: string };

export default function Home() {
  const [stage, setStage] = useState<AnalysisStage>('idle');
  const [subMessage, setSubMessage] = useState<string | undefined>();
  const [currentFile, setCurrentFile] = useState<string | undefined>();
  const [results, setResults] = useState<AnalysisResultEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  // Timer: inicia com 'extracting', para em 'done' ou 'error'
  useEffect(() => {
    if (stage === 'extracting') {
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);
    }

    const isActive = stage !== 'idle' && stage !== 'done' && stage !== 'error';
    if (!isActive) return;

    const interval = setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsedSeconds(Math.round((Date.now() - startTimeRef.current) / 1000));
      }
    }, 500);

    return () => clearInterval(interval);
  }, [stage]);

  async function handleFilesSelected(files: File[]) {
    setResults([]);
    setError(null);
    setSubMessage(undefined);

    const formData = new FormData();
    for (const f of files) formData.append('files', f);

    setCurrentFile(files.length === 1 ? files[0].name : `${files.length} arquivos`);
    setStage('extracting');

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });

      // Erros de validação (400) chegam como JSON, não SSE
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: '' }));
        throw new Error(body.error || `Erro HTTP ${res.status} — verifique os logs do servidor`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let event: SSEEvent;
          try {
            event = JSON.parse(line.slice(6)) as SSEEvent;
          } catch {
            continue;
          }

          if (event.type === 'progress') {
            setStage(event.stage);
            setSubMessage(event.message);
          } else if (event.type === 'result') {
            if (startTimeRef.current !== null) {
              setElapsedSeconds(Math.round((Date.now() - startTimeRef.current) / 1000));
            }
            setResults(
              event.results.map((r) => ({
                filename: r.filename,
                analysis: r.analysis,
                reportPdfBase64: r.reportPdf,
                annotatedPdfBase64: r.annotatedPdf,
              })),
            );
            setStage('done');
          } else if (event.type === 'error') {
            throw new Error(event.message);
          }
        }
      }
    } catch (err) {
      if (startTimeRef.current !== null) {
        setElapsedSeconds(Math.round((Date.now() - startTimeRef.current) / 1000));
      }
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
            <ProgressIndicator
              stage={stage}
              filename={currentFile}
              subMessage={subMessage}
              elapsedSeconds={elapsedSeconds}
            />
            {stage === 'error' && error && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm font-semibold text-red-700 mb-1">Detalhe do erro:</p>
                <p className="text-sm text-red-600 font-mono break-all">{error}</p>
              </div>
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
