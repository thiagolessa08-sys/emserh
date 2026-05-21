'use client';

export type AnalysisStage =
  | 'idle'
  | 'extracting'
  | 'ocr'
  | 'analyzing'
  | 'generating'
  | 'done'
  | 'error';

const STAGE_LABELS: Record<AnalysisStage, string> = {
  idle: '',
  extracting: 'Extraindo texto do PDF...',
  ocr: 'Processando páginas escaneadas com OCR...',
  analyzing: 'Analisando conformidade com IA...',
  generating: 'Gerando Relatório de Conformidade...',
  done: 'Análise concluída!',
  error: 'Erro durante a análise.',
};

const STAGE_ORDER: AnalysisStage[] = ['extracting', 'ocr', 'analyzing', 'generating', 'done'];

interface ProgressIndicatorProps {
  stage: AnalysisStage;
  filename?: string;
}

export function ProgressIndicator({ stage, filename }: ProgressIndicatorProps) {
  if (stage === 'idle') return null;

  const currentIndex = STAGE_ORDER.indexOf(stage);

  return (
    <div role="status" aria-live="polite" className="w-full space-y-4">
      {filename && (
        <p className="text-sm text-gray-500 text-center truncate">Processando: {filename}</p>
      )}

      <div className="flex items-center gap-2">
        {STAGE_ORDER.filter((s) => s !== 'done').map((s, idx) => {
          const isDone = currentIndex > idx || stage === 'done';
          const isCurrent = currentIndex === idx && stage !== 'done' && stage !== 'error';
          return (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={[
                  'h-2 rounded-full w-full transition-all duration-500',
                  isDone ? 'bg-blue-500' : isCurrent ? 'bg-blue-300 animate-pulse' : 'bg-gray-200',
                ].join(' ')}
              />
            </div>
          );
        })}
      </div>

      <p
        className={[
          'text-center text-sm font-medium',
          stage === 'error' ? 'text-red-600' : stage === 'done' ? 'text-green-600' : 'text-blue-600',
        ].join(' ')}
      >
        {STAGE_LABELS[stage]}
      </p>
    </div>
  );
}
