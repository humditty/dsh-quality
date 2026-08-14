import type { CheckResult } from "./check-result.js";

export type QualityStatus = "PASS" | "WARN" | "FAIL";

export interface QualityResult {
  runId: string;
  status: QualityStatus;
  results: CheckResult[];
  summary: string;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  error?: string;
}
