import type { GateCompleteness, GateReason, GateResult, GateVerdict } from "../model/gate-result.js";
import type { ChangeSet } from "../model/change-set.js";
import type { QualityPlan, VerificationObligation } from "../model/quality-plan.js";
import type { InMemoryEvidenceStore } from "../evidence/evidence-store.js";

export type QualityMode = "advisory" | "gate" | "strict";

export class GateEvaluator {
  constructor(private readonly mode: QualityMode) {}

  evaluate(changeSet: ChangeSet, plan: QualityPlan, store: InMemoryEvidenceStore): GateResult {
    const reasons: GateReason[] = [];
    const evidence = [];
    let completeness: GateCompleteness = "COMPLETE";
    if (this.mode === "strict" && changeSet.confidence !== "high") {
      completeness = "INCOMPLETE";
      reasons.push({ code: "CHANGESET_UNVERIFIABLE", message: "Strict mode requires a high-confidence change set." });
    }
    for (const obligation of plan.obligations.filter((item) => item.required)) {
      const lookup = store.find(obligation, plan);
      if (!lookup.evidence) {
        completeness = "INCOMPLETE";
        reasons.push({ code: "EVIDENCE_MISSING", obligationId: obligation.id, message: `Required ${obligation.kind} evidence is missing.` });
        continue;
      }
      evidence.push(lookup.evidence);
      if (lookup.freshness !== "FRESH") {
        completeness = "INCOMPLETE";
        reasons.push({ code: "EVIDENCE_STALE", obligationId: obligation.id, message: `Required ${obligation.kind} evidence is stale.` });
        continue;
      }
      if (lookup.evidence.outcome === "FAIL") {
        reasons.push({ code: "TEST_FAILED", obligationId: obligation.id, message: lookup.evidence.summary });
      } else if (lookup.evidence.outcome === "ERROR" || lookup.evidence.outcome === "SKIPPED") {
        completeness = "INCOMPLETE";
        reasons.push({ code: "PROVIDER_ERROR", obligationId: obligation.id, message: lookup.evidence.summary });
      }
    }
    const verdict: GateVerdict = reasons.length === 0 ? "ALLOW" : this.mode === "advisory" ? "WARN" : "BLOCK";
    return { verdict, completeness, reasons, evidence };
  }
}
