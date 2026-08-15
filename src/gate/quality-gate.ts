import { randomUUID } from "node:crypto";
import { isFresh } from "../evidence/freshness.js";
import type { VerificationEvidence } from "../evidence/verification-evidence.js";
import { FeedbackComposer } from "../feedback/feedback-composer.js";
import type { QualityContext } from "../model/quality-context.js";
import { RepairLoopController } from "../repair/repair-controller.js";
import { createQualityState, type QualityState } from "../repair/repair-state.js";
import type { CommandVerifier } from "../verification/command-verifier.js";
import type { WorkspaceFingerprinter } from "../workspace/workspace-fingerprinter.js";

export interface QualityGateContext extends QualityContext {
  agentId?: string;
}

export interface QualityGateResult {
  verdict: "ALLOW" | "BLOCK";
  state: QualityState;
  evidence?: VerificationEvidence;
  feedback?: string;
  shouldSteer: boolean;
}

export class QualityGate {
  private readonly states = new Map<string, QualityState>();

  constructor(
    private readonly fingerprinter: WorkspaceFingerprinter,
    private readonly verifier: CommandVerifier,
    private readonly repair: RepairLoopController,
    private readonly feedback: FeedbackComposer
  ) {}

  async gate(context: QualityGateContext): Promise<QualityGateResult> {
    const state = this.stateFor(context);
    if (state.terminalFailureMode) return { verdict: "ALLOW", state, shouldSteer: false };

    let current: string;
    try {
      current = await this.fingerprinter.fingerprint(context.projectRoot);
    } catch (error) {
      return this.fail(state, this.errorEvidence("workspace fingerprint", "unavailable", error));
    }
    if (isFresh(state.lastEvidence, current)) return { verdict: "ALLOW", state, evidence: state.lastEvidence, shouldSteer: false };

    const evidence = await this.verifyStableWorkspace(context, current);
    state.lastEvidence = evidence;
    if (evidence.status === "PASS") {
      this.repair.reset(state);
      return { verdict: "ALLOW", state, evidence, shouldSteer: false };
    }
    return this.fail(state, evidence);
  }

  private async verifyStableWorkspace(context: QualityGateContext, initialFingerprint: string): Promise<VerificationEvidence> {
    let before = initialFingerprint;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const evidence = await this.collect(context, before);
      let after: string;
      try {
        after = await this.fingerprinter.fingerprint(context.projectRoot);
      } catch (error) {
        return this.errorEvidence(evidence.command, before, error, evidence);
      }
      if (before === after) return evidence;
      before = after;
    }
    return this.errorEvidence("verification", before, new Error("Workspace changed during verification twice; automatic re-verification stopped."));
  }

  private async collect(context: QualityGateContext, fingerprint: string): Promise<VerificationEvidence> {
    try {
      return await this.verifier.verify(context, fingerprint);
    } catch (error) {
      return this.errorEvidence("verification", fingerprint, error);
    }
  }

  private fail(state: QualityState, evidence: VerificationEvidence): QualityGateResult {
    const decision = this.repair.recordFailure(state, evidence);
    return {
      verdict: "BLOCK",
      state,
      evidence,
      feedback: this.feedback.compose(evidence, state, decision.terminal),
      shouldSteer: decision.shouldSteer
    };
  }

  private stateFor(context: QualityGateContext): QualityState {
    const key = `${context.agentId ?? "default"}:${context.projectRoot}`;
    const existing = this.states.get(key);
    if (existing) return existing;
    const state = createQualityState();
    this.states.set(key, state);
    return state;
  }

  private errorEvidence(command: string, workspaceFingerprint: string, error: unknown, prior?: VerificationEvidence): VerificationEvidence {
    const now = Date.now();
    return {
      id: randomUUID(), type: "COMMAND", producer: "quality-gate", workspaceFingerprint, command, status: "ERROR",
      exitCode: prior?.exitCode, startedAt: prior?.startedAt ?? now, finishedAt: now, durationMs: prior?.durationMs ?? 0,
      stdout: prior?.stdout, stderr: `${prior?.stderr ?? ""}\n${(error as Error).message}`.trim()
    };
  }
}
