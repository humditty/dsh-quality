import type { QualityEvidence } from "./quality-evidence.js";

export type GateVerdict = "ALLOW" | "WARN" | "BLOCK";
export type GateCompleteness = "COMPLETE" | "INCOMPLETE";
export type GateReasonCode =
  | "TEST_FAILED"
  | "EVIDENCE_MISSING"
  | "EVIDENCE_STALE"
  | "PROVIDER_ERROR"
  | "CHANGESET_UNVERIFIABLE"
  | "WORKSPACE_CHANGED_DURING_VERIFICATION"
  | "REPAIR_LIMIT_REACHED";

export interface GateReason {
  code: GateReasonCode;
  obligationId?: string;
  message: string;
}

export interface GateResult {
  verdict: GateVerdict;
  completeness: GateCompleteness;
  reasons: GateReason[];
  evidence: QualityEvidence[];
}
