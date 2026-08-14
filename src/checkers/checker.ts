import type { CheckResult } from "../model/check-result.js";
import type { QualityContext } from "../model/quality-context.js";

export interface QualityChecker {
  id: string;
  name: string;
  supports(context: QualityContext): boolean;
  check(context: QualityContext): Promise<CheckResult>;
}
