import type { GateResult } from "../model/gate-result.js";
import { QualityCoordinator } from "../gate/quality-coordinator.js";
import { QualityGate, type QualityGateResult } from "../gate/quality-gate.js";

export interface HarnessEvent {
  type: "tools/result" | "tools/post-execute" | "agent/turn-stopping";
  projectRoot: string;
  changedFiles: string[];
  success: boolean;
  agentId?: string;
  metadata?: Record<string, unknown>;
  changeSetConfidence?: "high" | "low";
  mayHaveMutated?: boolean;
  signal?: AbortSignal;
}

export class HarnessHook {
  constructor(
    private readonly gate: QualityCoordinator | QualityGate,
    private readonly onFeedback?: (message: string) => void,
    private readonly onSteer?: (message: string) => void
  ) {}

  async handle(event: HarnessEvent): Promise<GateResult | QualityGateResult | undefined> {
    if (event.metadata?.source === "dsh-quality") return undefined;
    if (event.type === "tools/result" || event.type === "tools/post-execute") {
      if (this.gate instanceof QualityCoordinator) {
        this.gate.observeToolResult({
          agentId: event.agentId,
          projectRoot: event.projectRoot,
          changedFiles: event.changedFiles,
          success: event.success,
          source: typeof event.metadata?.source === "string" ? event.metadata.source : undefined,
          mayHaveMutated: event.mayHaveMutated
        });
      }
      return undefined;
    }
    if (!event.success) return undefined;
    const context = {
      agentId: event.agentId,
      projectRoot: event.projectRoot,
      changedFiles: event.changedFiles,
      metadata: event.metadata,
      changeSetConfidence: event.changeSetConfidence,
      signal: event.signal
    };
    if (this.gate instanceof QualityCoordinator) {
      const gate = await this.gate.gate(context);
      if (gate.result.verdict !== "BLOCK") return gate.result;
      const feedback = formatGateFeedback(gate.result, gate.repairAttempt, !gate.shouldSteer);
      this.onFeedback?.(feedback);
      if (gate.shouldSteer) this.onSteer?.(feedback);
      return gate.result;
    }
    const gate = await this.gate.gate(context);
    if (gate.verdict === "BLOCK" && gate.feedback) {
      this.onFeedback?.(gate.feedback);
      if (gate.shouldSteer) this.onSteer?.(gate.feedback);
    }
    return gate;
  }
}

export function formatGateFeedback(result: GateResult, repairAttempt?: number, repairStopped = false): string {
  const lines = ["Quality Gate BLOCKED", "", ...result.reasons.filter((reason) => reason.code !== "REPAIR_LIMIT_REACHED").map((reason) => `- ${reason.message}`)];
  if (repairAttempt !== undefined) lines.push("", `Repair attempts for this change set: ${repairAttempt}`);
  if (repairStopped || result.reasons.some((reason) => reason.code === "REPAIR_LIMIT_REACHED")) lines.push("Automatic repair stopped. Please inspect the remaining issue or start a new repair turn.");
  else lines.push("Please fix the blocking issue and verify again.");
  return lines.join("\n");
}
