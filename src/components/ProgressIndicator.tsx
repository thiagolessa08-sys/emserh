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
  ocr: 'Processando OCR nas páginas escaneadas...',
  analyzing: 'Analisando conformidade com IA...',
  generating: 'Gerando Relatório de Conformidade...',
  done: 'Análise concluída!',
  error: 'Erro durante a análise.',
};

const STEP_NAMES: Record<string, string> = {
  extracting: 'Extração',
  ocr: 'OCR',
  analyzing: 'IA',
  generating: 'Relatório',
};

const STAGE_ORDER: AnalysisStage[] = ['extracting', 'ocr', 'analyzing', 'generating', 'done'];
const BAR_STEPS = STAGE_ORDER.filter((s) => s !== 'done');

interface ProgressIndicatorProps {
  stage: AnalysisStage;
  filename?: string;
  subMessage?: string;
  elapsedSeconds?: number;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function ProgressIndicator({ stage, filename, subMessage, elapsedSeconds }: ProgressIndicatorProps) {
  if (stage === 'idle') return null;

  const currentIndex = STAGE_ORDER.indexOf(stage);
  const displayMessage = subMessage || STAGE_LABELS[stage];

  const isActive = stage !== 'done' && stage !== 'error';
  const isError = stage === 'error';
  const isDone = stage === 'done';

  return (
    <div role="status" aria-live="polite" className="w-full space-y-4">
      {filename && (
        <p className="text-sm text-gray-500 text-center truncate">
          Processando: <span className="font-medium text-gray-700">{filename}</span>
        </p>
      )}

      {/* Barra de progresso com rótulos */}
      <div className="flex items-start gap-2">
        {BAR_STEPS.map((s, idx) => {
          const stepDone = currentIndex > idx || isDone;
          const stepCurrent = currentIndex === idx && isActive;
          return (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={[
                  'h-2 rounded-full w-full transition-all duration-500',
                  isError
                    ? stepDone
                      ? 'bg-red-300'
                      : 'bg-gray-200'
                    : stepDone
                    ? 'bg-blue-500'
                    : stepCurrent
                    ? 'bg-blue-300 animate-pulse'
                    : 'bg-gray-200',
                ].join(' ')}
              />
              <span
                className={[
                  'text-[10px] font-medium',
                  stepDone && !isError
                    ? 'text-blue-500'
                    : stepCurrent
                    ? 'text-blue-400'
                    : 'text-gray-300',
                ].join(' ')}
              >
                {STEP_NAMES[s]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mensagem principal + timer */}
      <div className="flex items-center justify-center gap-3">
        <p
          className={[
            'text-sm font-medium text-center',
            isError ? 'text-red-600' : isDone ? 'text-green-600' : 'text-blue-600',
          ].join(' ')}
        >
          {displayMessage}
        </p>

        {elapsedSeconds !== undefined && elapsedSeconds > 0 && (
          <span
            className={[
              'text-xs tabular-nums shrink-0',
              isDone ? 'text-green-500' : isError ? 'text-red-400' : 'text-gray-400',
            ].join(' ')}
          >
            {isDone ? `em ${formatTime(elapsedSeconds)}` : formatTime(elapsedSeconds)}
          </span>
        )}
      </div>
    </div>
  );
}
