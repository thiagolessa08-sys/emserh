'use client';

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/Header';
import { Stepper } from '@/components/Stepper';
import { Sidebar } from '@/components/Sidebar';
import { UploadArea } from '@/components/UploadArea';
import { ResultPanel } from '@/components/ResultPanel';
import { SegmentSelector } from '@/components/SegmentSelector';
import type { AnalysisResult, SegmentoId, Modalidade } from '@/lib/types';
import type { AnalysisStage } from '@/components/ProgressIndicator';

const ANALYSIS_STEPS: { stage: AnalysisStage; label: string; desc: string }[] = [
  { stage: 'extracting', label: 'Extração de texto', desc: 'Lendo e convertendo páginas do PDF' },
  { stage: 'ocr', label: 'Reconhecimento OCR', desc: 'Processando páginas digitalizadas com OCR' },
  { stage: 'triaging', label: 'Triagem de documentos', desc: 'Localizando as páginas relevantes do processo' },
  { stage: 'analyzing', label: 'Análise de conformidade', desc: 'Verificando os itens do checklist do segmento' },
  { stage: 'generating', label: 'Geração do relatório', desc: 'Criando PDF anotado e relatório de conformidade' },
];

const STAGE_ORDER: AnalysisStage[] = ['extracting', 'ocr', 'triaging', 'analyzing', 'generating'];

function stageState(step: AnalysisStage, current: AnalysisStage): 'done' | 'active' | 'pending' {
  const si = STAGE_ORDER.indexOf(step);
  const ci = STAGE_ORDER.indexOf(current);
  if (ci === -1) return 'pending';
  if (si < ci) return 'done';
  if (si === ci) return 'active';
  return 'pending';
}

interface AnalysisResultEntry {
  filename: string;
  analysis: AnalysisResult;
  focusedText: string;
  reportPdfBase64: string;
  annotatedPdfBase64: string;
}

type SSEEvent =
  | { type: 'progress'; stage: AnalysisStage; message: string }
  | {
      type: 'result';
      results: Array<{
        filename: string;
        analysis: AnalysisResult;
        focusedText: string;
        reportPdf: string;
        annotatedPdf: string;
      }>;
    }
  | { type: 'error'; message: string };

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function BreadcrumbChevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path
        d="M3.5 2L6.5 5L3.5 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg className="arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileThumbnail() {
  return (
    <div className="file-thumb">
      <div className="file-thumb-lines">
        <div />
        <div />
        <div />
        <div />
      </div>
      <span className="file-thumb-label">PDF</span>
    </div>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2 2l10 10M12 2L2 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Home() {
  const [stage, setStage] = useState<AnalysisStage>('idle');
  const [subMessage, setSubMessage] = useState<string | undefined>();
  const [results, setResults] = useState<AnalysisResultEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [processingFiles, setProcessingFiles] = useState<File[]>([]);
  const [segmento, setSegmento] = useState<SegmentoId | ''>('');
  const [modalidade, setModalidade] = useState<Modalidade>('contrato');
  const startTimeRef = useRef<number | null>(null);

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

  function resetToHome() {
    if (isProcessing) return; // não interrompe uma análise em andamento
    setStage('idle');
    setResults([]);
    setPendingFiles([]);
    setProcessingFiles([]);
    setSegmento('');
    setModalidade('contrato');
    setError(null);
    setSubMessage(undefined);
  }

  function handleFilesAdded(files: File[]) {
    setPendingFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}-${f.size}`));
      return [...prev, ...files.filter((f) => !existing.has(`${f.name}-${f.size}`))];
    });
  }

  function removePendingFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleStartAnalysis() {
    if (pendingFiles.length === 0) return;
    const files = [...pendingFiles];
    setProcessingFiles(files);
    setPendingFiles([]);
    await runAnalysis(files);
    setProcessingFiles([]);
  }

  async function runAnalysis(files: File[]) {
    setResults([]);
    setError(null);
    setSubMessage(undefined);

    const formData = new FormData();
    for (const f of files) formData.append('files', f);
    formData.append('segmento', segmento || 'fornecedor');
    formData.append('modalidade', modalidade);

    setStage('extracting');

    // Timeout global de 10 minutos no cliente
    const clientAbort = new AbortController();
    const clientTimeout = setTimeout(() => clientAbort.abort(), 10 * 60 * 1000);

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: formData, signal: clientAbort.signal });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: '' }));
        throw new Error(body.error || `Erro HTTP ${res.status}`);
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
                focusedText: r.focusedText,
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
      const isAbort = err instanceof Error && err.name === 'AbortError';
      setError(
        isAbort
          ? 'Tempo limite excedido (10 min). O documento pode ser grande demais — tente dividir o processo em partes menores e enviar separadamente.'
          : (err instanceof Error ? err.message : String(err))
      );
      setStage('error');
    } finally {
      clearTimeout(clientTimeout);
    }
  }

  const isProcessing = stage !== 'idle' && stage !== 'done' && stage !== 'error';
  const stepperStep: 1 | 2 | 3 = stage === 'done' ? 3 : isProcessing ? 2 : 1;

  return (
    <>
      <Header onLogoClick={resetToHome} />
      <main className="page">
        {/* Page header — span 2 colunas */}
        <div className="page-header">
          <div>
            <div className="breadcrumb">
              <span>GCIF</span>
              <BreadcrumbChevron />
              <span>Auditoria documental</span>
              <BreadcrumbChevron />
              <span>Nova análise</span>
            </div>
            <h1 className="page-title">
              Submeta os documentos
              <br />
              para <em>análise de conformidade</em>
            </h1>
            <p className="page-sub">
              Envie processos de pagamento, contratos e notas fiscais em PDF. O sistema
              verifica os itens conforme a IN nº 03/2021 e devolve um relatório com as
              não conformidades.
            </p>
          </div>
          <Stepper step={stepperStep} />
        </div>

        {/* Coluna principal */}
        <div className="main">
          {/* Seletor de segmento — visível apenas em idle/error */}
          {!isProcessing && stage !== 'done' && (
            <SegmentSelector
              segmento={segmento}
              modalidade={modalidade}
              onChange={(s, m) => { setSegmento(s); setModalidade(m); }}
            />
          )}

          {/* Upload — visível apenas em idle/error */}
          {!isProcessing && stage !== 'done' && (
            <div className="card">
              <div className="card-head">
                <div className="card-title">
                  Adicionar arquivos
                  {pendingFiles.length > 0 && (
                    <span className="count">{pendingFiles.length}</span>
                  )}
                </div>
              </div>
              <div className="card-body">
                <UploadArea onFilesSelected={handleFilesAdded} disabled={isProcessing || !segmento} />
              </div>
            </div>
          )}

          {/* Fila de arquivos */}
          {pendingFiles.length > 0 && !isProcessing && (
            <div className="card">
              <div className="card-head">
                <div className="card-title">
                  Fila de análise
                  <span className="count">{pendingFiles.length}</span>
                </div>
                <button className="card-action" onClick={() => setPendingFiles([])}>
                  Limpar tudo
                </button>
              </div>
              <div className="card-body">
                <div className="file-list">
                  {pendingFiles.map((f, i) => (
                    <div key={`${f.name}-${f.size}-${i}`} className="file-row">
                      <FileThumbnail />
                      <div className="file-info">
                        <div className="file-name">{f.name}</div>
                        <div className="file-meta">
                          <span>{formatSize(f.size)}</span>
                        </div>
                      </div>
                      <span className="file-status queued">Na fila</span>
                      <button
                        className="file-remove"
                        aria-label={`Remover ${f.name}`}
                        onClick={() => removePendingFile(i)}
                      >
                        <XIcon />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="submit-row">
                  <button className="btn-primary" onClick={handleStartAnalysis}>
                    Iniciar análise de {pendingFiles.length} arquivo
                    {pendingFiles.length > 1 ? 's' : ''}
                    <ArrowRight />
                  </button>
                  <button className="btn-secondary" onClick={() => setPendingFiles([])}>
                    Limpar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Processando */}
          {isProcessing && (
            <div className="card">
              <div className="card-head">
                <div className="card-title">
                  Processando
                  <span className="count">
                    <span className="spinner" />
                  </span>
                </div>
                {elapsedSeconds > 0 && (
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--em-muted)',
                      fontFamily: 'var(--font-jetbrains-mono)',
                    }}
                  >
                    {formatTime(elapsedSeconds)}
                  </span>
                )}
              </div>
              <div className="card-body">
                {/* Arquivos sendo processados */}
                <div className="file-list">
                  {processingFiles.map((f) => (
                    <div key={`${f.name}-${f.size}`} className="file-row analyzing">
                      <FileThumbnail />
                      <div className="file-info">
                        <div className="file-name">{f.name}</div>
                        <div className="file-meta">
                          <span>{formatSize(f.size)}</span>
                        </div>
                        <div className="analyzing-bar">
                          <div className="analyzing-bar-inner" />
                        </div>
                      </div>
                      <span className="file-status processing">Em análise</span>
                      <div />
                    </div>
                  ))}
                </div>

                {/* Rastreador de etapas */}
                <div className="stage-list">
                  {ANALYSIS_STEPS.map((s) => {
                    const state = stageState(s.stage, stage);
                    return (
                      <div key={s.stage} className={`stage-item ${state}`}>
                        <div className="stage-icon">
                          {state === 'done' ? (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path
                                d="M3 8l3.5 3.5L13 5"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : state === 'active' ? (
                            <span className="spinner" />
                          ) : (
                            <span className="stage-dot" />
                          )}
                        </div>
                        <div className="stage-text">
                          <div className="stage-label">{s.label}</div>
                          <div className="stage-desc">
                            {state === 'active' && subMessage ? subMessage : s.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Erro */}
          {stage === 'error' && error && (
            <div className="card" style={{ borderColor: 'var(--err)' }}>
              <div className="card-head">
                <div className="card-title" style={{ color: 'var(--err)' }}>
                  Erro na análise
                </div>
              </div>
              <div className="card-body">
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--em-muted)',
                    fontFamily: 'var(--font-jetbrains-mono)',
                    wordBreak: 'break-word',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {error}
                </p>
                <button
                  className="btn-secondary"
                  style={{ marginTop: '14px' }}
                  onClick={() => {
                    setStage('idle');
                    setError(null);
                  }}
                >
                  ← Tentar novamente
                </button>
              </div>
            </div>
          )}

          {/* Resultados */}
          {results.map((r) => (
            <ResultPanel
              key={r.filename}
              filename={r.filename}
              analysis={r.analysis}
              focusedText={r.focusedText}
              segmento={(segmento || 'fornecedor') as SegmentoId}
              modalidade={modalidade}
              reportPdfBase64={r.reportPdfBase64}
              annotatedPdfBase64={r.annotatedPdfBase64}
            />
          ))}

          {/* Nova análise */}
          {stage === 'done' && (
            <button className="btn-secondary" onClick={resetToHome}>
              ← Nova análise
            </button>
          )}

          <p className="footer-note">
            Conforme <strong>IN EMSERH nº 03/2021</strong> — Uso exclusivo GCIF.
          </p>
        </div>

        {/* Sidebar */}
        <Sidebar />
      </main>
    </>
  );
}
