import type { QualityResult } from "../model/quality-result.js";

export interface QualityReporter {
  report(result: QualityResult): Promise<void>;
}
