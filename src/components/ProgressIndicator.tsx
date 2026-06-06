export type AnalysisStage =
  | 'idle'
  | 'extracting'
  | 'ocr'
  | 'triaging'
  | 'analyzing'
  | 'generating'
  | 'done'
  | 'error';
