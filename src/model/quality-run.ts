import type { QualityContext } from "./quality-context.js";
import type { CheckResult } from "./check-result.js";
import type { QualityResult } from "./quality-result.js";

export type QualityRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface QualityRun {
  id: string;
  startedAt: Date;
  finishedAt?: Date;
  status: QualityRunStatus;
  context: QualityContext;
  checks: CheckResult[];
  result?: QualityResult;
}
