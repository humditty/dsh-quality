import type { VerificationEvidence } from "./verification-evidence.js";

export function isFresh(evidence: VerificationEvidence | undefined, currentFingerprint: string): boolean {
  return evidence?.status === "PASS" && evidence.workspaceFingerprint === currentFingerprint;
}
