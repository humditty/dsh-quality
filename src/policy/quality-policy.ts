import type { CheckResult } from "../model/check-result.js";
import type { QualityContext } from "../model/quality-context.js";

export interface QualityDecision {
  status: "PASS" | "WARN" | "FAIL";
  reasons: string[];
}

export interface QualityPolicy {
  evaluate(results: CheckResult[], context: QualityContext): QualityDecision;
}
