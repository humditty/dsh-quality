import { digest } from "../utils/digest.js";
import type { ChangeSet } from "../model/change-set.js";
import type { QualityPlan, VerificationObligation } from "../model/quality-plan.js";

export class DeterministicQualityPlanner {
  plan(changeSet: ChangeSet): QualityPlan {
    const mustRunFullTest = changeSet.confidence === "low" || changeSet.entries.some((entry) => entry.kind !== "docs");
    const obligations: VerificationObligation[] = mustRunFullTest ? [{
      id: "test:full",
      kind: "test",
      required: true,
      scope: ["."],
      inputDigest: digest({ confidence: changeSet.confidence, entries: changeSet.entries.map(({ path, contentDigest }) => ({ path, contentDigest })) }),
      reason: changeSet.confidence === "low" ? "Change set is not fully attributable; run the full test suite." : "Source, test, build, or unknown files changed."
    }] : [];
    const planDigest = digest({ obligations: obligations.map(({ id, kind, required, scope, inputDigest }) => ({ id, kind, required, scope, inputDigest })) });
    return {
      id: `plan:${planDigest.slice(0, 16)}`,
      changeSetId: changeSet.id,
      digest: planDigest,
      obligations,
      createdAt: new Date()
    };
  }
}
