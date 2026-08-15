import { createFailureFingerprint } from "../evidence/failure-fingerprint.js";
import type { VerificationEvidence } from "../evidence/verification-evidence.js";
import type { QualityState } from "./repair-state.js";

export interface RepairLoopConfig {
  enabled: boolean;
  maxAttempts: number;
  maxSameFailure: number;
}

export interface RepairLoopDecision {
  shouldSteer: boolean;
  terminal: boolean;
}

export class RepairLoopController {
  constructor(private readonly config: RepairLoopConfig) {}

  reset(state: QualityState): void {
    state.repairAttempts = 0;
    state.sameFailureCount = 0;
    state.lastFailureFingerprint = undefined;
    state.terminalFailureMode = false;
  }

  recordFailure(state: QualityState, evidence: VerificationEvidence): RepairLoopDecision {
    const fingerprint = evidence.failureFingerprint ?? createFailureFingerprint(evidence) ?? "unknown-failure";
    state.sameFailureCount = fingerprint === state.lastFailureFingerprint ? state.sameFailureCount + 1 : 1;
    state.lastFailureFingerprint = fingerprint;
    state.repairAttempts += 1;
    const terminal = !this.config.enabled
      || state.repairAttempts >= this.config.maxAttempts
      || state.sameFailureCount >= this.config.maxSameFailure;
    if (terminal) state.terminalFailureMode = true;
    return { shouldSteer: this.config.enabled, terminal };
  }
}
