import type { QualityIssue } from "./quality-issue.js";

export type CheckStatus = "PASS" | "WARN" | "FAIL" | "ERROR" | "SKIPPED";

export interface CheckResult {
  checkerId: string;
  status: CheckStatus;
  summary: string;
  durationMs: number;
  details?: unknown;
  issues?: QualityIssue[];
}
