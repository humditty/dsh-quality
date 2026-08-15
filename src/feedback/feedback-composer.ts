import { tail } from "../evidence/failure-fingerprint.js";
import type { VerificationEvidence } from "../evidence/verification-evidence.js";
import type { RepairLoopConfig } from "../repair/repair-controller.js";
import type { QualityState } from "../repair/repair-state.js";

export interface FeedbackConfig {
  stdoutTail: number;
  stderrTail: number;
  maxChars: number;
}

export class FeedbackComposer {
  constructor(private readonly config: FeedbackConfig, private readonly repair: RepairLoopConfig) {}

  compose(evidence: VerificationEvidence, state: QualityState, terminal: boolean): string {
    const output = [
      terminal ? "DSH Quality has stopped automatic repair." : "DSH Quality verification failed.",
      "",
      terminal ? "Verification is still failing. Do not claim that the task succeeded." : "",
      `Command: ${evidence.command}`,
      `Exit code: ${evidence.exitCode ?? "unknown"}`,
      `Workspace: ${shortFingerprint(evidence.workspaceFingerprint)}`,
      `Status: ${evidence.status}`,
      `Repair attempt: ${state.repairAttempts} / ${this.repair.maxAttempts}`,
      `Same failure: ${state.sameFailureCount} / ${this.repair.maxSameFailure}`,
      terminal ? "Summarize what was implemented, which verification is failing, and what remains unresolved." : "",
      "",
      "Relevant output:",
      tail(evidence.stderr ?? "", this.config.stderrTail),
      tail(evidence.stdout ?? "", this.config.stdoutTail)
    ].filter(Boolean).join("\n");
    return truncateFeedback(output, this.config.maxChars);
  }
}

export function truncateFeedback(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  const marker = "[truncated]\n...\n";
  if (maxChars <= marker.length) return marker.slice(0, maxChars);
  return marker + content.slice(-(maxChars - marker.length));
}

function shortFingerprint(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 12)}…`;
}
