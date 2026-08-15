import type { QualityContext } from "../model/quality-context.js";
import type { ChangeSet } from "../model/change-set.js";
import type { QualityPlan, VerificationObligation } from "../model/quality-plan.js";
import type { GateResult } from "../model/gate-result.js";
import type { QualityEvidence } from "../model/quality-evidence.js";
import { ChangeTracker } from "../change/change-tracker.js";
import { InMemoryEvidenceStore } from "../evidence/evidence-store.js";
import { GateEvaluator, type QualityMode } from "./gate-evaluator.js";
import { RepairController, type RepairConfig } from "./repair-controller.js";
import { DeterministicQualityPlanner } from "../planning/quality-planner.js";
import type { EvidenceProvider } from "../providers/evidence-provider.js";
import { randomUUID } from "node:crypto";

export interface QualityCoordinatorOptions {
  tracker: ChangeTracker;
  planner: DeterministicQualityPlanner;
  providers: EvidenceProvider[];
  store: InMemoryEvidenceStore;
  evaluator: GateEvaluator;
  mode: QualityMode;
  repair: RepairConfig;
  autoExecuteMissingEvidence?: boolean;
}

export interface CoordinatedGateResult {
  changeSet: ChangeSet;
  plan: QualityPlan;
  result: GateResult;
  shouldSteer: boolean;
  repairAttempt?: number;
}

export class QualityCoordinator {
  private readonly autoExecuted = new Set<string>();
  private readonly inFlight = new Map<string, Promise<CoordinatedGateResult>>();
  private readonly repair: RepairController;
  private readonly autoExecuteMissingEvidence: boolean;

  constructor(private readonly options: QualityCoordinatorOptions) {
    this.repair = new RepairController(options.repair);
    this.autoExecuteMissingEvidence = options.autoExecuteMissingEvidence ?? true;
  }

  observeToolResult(observation: { agentId?: string; projectRoot: string; changedFiles: string[]; success: boolean; source?: string; mayHaveMutated?: boolean }): void {
    this.options.tracker.observe(observation);
  }

  gate(context: QualityContext & { agentId?: string; changeSetConfidence?: "high" | "low" }): Promise<CoordinatedGateResult> {
    const key = `${context.agentId ?? "default"}:${context.projectRoot}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    let run: Promise<CoordinatedGateResult>;
    run = this.runGate(context).finally(() => {
      if (this.inFlight.get(key) === run) this.inFlight.delete(key);
    });
    this.inFlight.set(key, run);
    return run;
  }

  private async runGate(context: QualityContext & { agentId?: string; changeSetConfidence?: "high" | "low" }): Promise<CoordinatedGateResult> {
    const changeSet = this.options.tracker.snapshot({ agentId: context.agentId, projectRoot: context.projectRoot, confidence: context.changeSetConfidence });
    const plan = this.options.planner.plan(changeSet);
    let result = this.options.evaluator.evaluate(changeSet, plan, this.options.store);
    const executionKey = `${changeSet.id}:${plan.digest}`;
    if (this.autoExecuteMissingEvidence && this.requiresExecution(result) && !this.autoExecuted.has(executionKey)) {
      this.autoExecuted.add(executionKey);
      await this.collectMissingEvidence(plan, context);
      result = this.options.evaluator.evaluate(changeSet, plan, this.options.store);
    }
    if (result.verdict !== "BLOCK") return { changeSet, plan, result, shouldSteer: false };
    const repair = this.repair.registerBlock(context.agentId, changeSet.id, result);
    if (repair.limitReached) result = { ...result, reasons: [...result.reasons, { code: "REPAIR_LIMIT_REACHED", message: "Automatic repair stopped because the same gate failure persisted." }] };
    return { changeSet, plan, result, shouldSteer: repair.shouldSteer, repairAttempt: repair.attempt };
  }

  private requiresExecution(result: GateResult): boolean {
    return result.reasons.some((reason) => reason.code === "EVIDENCE_MISSING" || reason.code === "EVIDENCE_STALE");
  }

  private async collectMissingEvidence(plan: QualityPlan, context: QualityContext): Promise<void> {
    for (const obligation of plan.obligations.filter((item) => item.required)) {
      const existing = this.options.store.find(obligation, plan);
      if (existing.freshness === "FRESH") continue;
      const provider = this.options.providers.find((candidate) => candidate.supports(obligation, context));
      const evidence = provider
        ? await this.collect(provider, obligation, plan, context)
        : this.missingProviderEvidence(obligation, plan, context);
      this.options.store.add(evidence);
    }
  }

  private async collect(provider: EvidenceProvider, obligation: VerificationObligation, plan: QualityPlan, context: QualityContext): Promise<QualityEvidence> {
    try {
      return await provider.collect(obligation, plan, context);
    } catch (error) {
      return {
        id: randomUUID(), obligationId: obligation.id, kind: obligation.kind, producer: { id: provider.id }, outcome: "ERROR", scope: obligation.scope,
        inputDigest: obligation.inputDigest, planDigest: plan.digest, observedAt: new Date(), durationMs: 0,
        provenance: { commandId: provider.id, cwd: context.projectRoot, timedOut: false }, summary: `Quality provider failed: ${(error as Error).message}`, issues: []
      };
    }
  }

  private missingProviderEvidence(obligation: VerificationObligation, plan: QualityPlan, context: QualityContext): QualityEvidence {
    return {
      id: randomUUID(), obligationId: obligation.id, kind: obligation.kind, producer: { id: "unavailable" }, outcome: "ERROR", scope: obligation.scope,
      inputDigest: obligation.inputDigest, planDigest: plan.digest, observedAt: new Date(), durationMs: 0,
      provenance: { commandId: "unavailable", cwd: context.projectRoot, timedOut: false }, summary: `No provider can satisfy ${obligation.id}.`, issues: []
    };
  }
}
