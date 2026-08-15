export interface QualityContext {
  projectRoot: string;
  changedFiles: string[];
  language?: string;
  framework?: string;
  metadata?: Record<string, unknown>;
  qualityRunActive?: boolean;
  signal?: AbortSignal;
}
