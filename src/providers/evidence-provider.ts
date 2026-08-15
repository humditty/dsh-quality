import type { QualityContext } from "../model/quality-context.js";
import type { QualityEvidence } from "../model/quality-evidence.js";
import type { QualityPlan, VerificationObligation } from "../model/quality-plan.js";

export interface EvidenceProvider {
  id: string;
  kind: VerificationObligation["kind"];
  supports(obligation: VerificationObligation, context: QualityContext): boolean;
  collect(obligation: VerificationObligation, plan: QualityPlan, context: QualityContext): Promise<QualityEvidence>;
}
