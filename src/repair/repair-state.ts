import type { VerificationEvidence } from "../evidence/verification-evidence.js";

export interface QualityState {
  lastEvidence?: VerificationEvidence;
  repairAttempts: number;
  sameFailureCount: number;
  lastFailureFingerprint?: string;
  terminalFailureMode: boolean;
}

export function createQualityState(): QualityState {
  return { repairAttempts: 0, sameFailureCount: 0, terminalFailureMode: false };
}
