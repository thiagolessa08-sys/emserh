export type AnalysisStage =
  | 'idle'
  | 'extracting'
  | 'ocr'
  | 'analyzing'
  | 'generating'
  | 'done'
  | 'error';
