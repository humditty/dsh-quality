export type QualitySeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface QualityIssue {
  severity: QualitySeverity;
  message: string;
  file?: string;
  line?: number;
  rule?: string;
  suggestion?: string;
}
