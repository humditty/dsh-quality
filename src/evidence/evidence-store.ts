import type { EvidenceFreshness, QualityEvidence } from "../model/quality-evidence.js";
import type { QualityPlan, VerificationObligation } from "../model/quality-plan.js";

export interface EvidenceLookup {
  evidence?: QualityEvidence;
  freshness?: EvidenceFreshness;
}

export class InMemoryEvidenceStore {
  private readonly entries = new Map<string, QualityEvidence[]>();

  add(evidence: QualityEvidence): void {
    const existing = this.entries.get(evidence.obligationId) ?? [];
    existing.push(evidence);
    this.entries.set(evidence.obligationId, existing);
  }

  find(obligation: VerificationObligation, plan: QualityPlan): EvidenceLookup {
    const candidates = this.entries.get(obligation.id) ?? [];
    if (candidates.length === 0) return {};
    const newest = candidates.at(-1)!;
    const freshness: EvidenceFreshness = newest.inputDigest === obligation.inputDigest && newest.planDigest === plan.digest ? "FRESH" : "STALE";
    return { evidence: newest, freshness };
  }

  values(): QualityEvidence[] {
    return [...this.entries.values()].flat();
  }
}
