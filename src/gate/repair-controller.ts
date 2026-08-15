import { digest } from "../utils/digest.js";
import type { GateResult } from "../model/gate-result.js";

export interface RepairConfig {
  enabled: boolean;
  maxSteersPerChangeSet: number;
  stopAfterSameFailure: number;
}

export interface RepairDecision {
  shouldSteer: boolean;
  attempt: number;
  limitReached: boolean;
}

export class RepairController {
  private readonly attempts = new Map<string, { steers: number; failures: Map<string, number> }>();

  registerBlock(agentId: string | undefined, changeSetId: string, result: GateResult): RepairDecision {
    const key = `${agentId ?? "default"}:${changeSetId}`;
    const state = this.attempts.get(key) ?? { steers: 0, failures: new Map<string, number>() };
    const signature = digest(result.reasons.map((reason) => ({ code: reason.code, obligationId: reason.obligationId, message: reason.message })));
    const sameFailureCount = (state.failures.get(signature) ?? 0) + 1;
    state.failures.set(signature, sameFailureCount);
    const limitReached = !this.config.enabled || state.steers >= this.config.maxSteersPerChangeSet || sameFailureCount >= this.config.stopAfterSameFailure;
    if (!limitReached) state.steers += 1;
    this.attempts.set(key, state);
    return { shouldSteer: !limitReached, attempt: sameFailureCount, limitReached };
  }

  constructor(private readonly config: RepairConfig) {}
}
