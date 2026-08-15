import type { QualityConfig } from "../config/config.js";
import { ChangeTracker } from "../change/change-tracker.js";
import { GitWorkspaceSnapshotter } from "../change/git-workspace-snapshotter.js";
import { InMemoryEvidenceStore } from "../evidence/evidence-store.js";
import { LocalProcessExecutor } from "../execution/local-process-executor.js";
import type { ProcessExecutor } from "../execution/process-executor.js";
import { DeterministicQualityPlanner } from "../planning/quality-planner.js";
import { TestChecker } from "../checkers/test/test-checker.js";
import { TestEvidenceProvider } from "../providers/test-evidence-provider.js";
import { GateEvaluator } from "./gate-evaluator.js";
import { QualityCoordinator } from "./quality-coordinator.js";

export function createDefaultQualityCoordinator(config: QualityConfig, executor: ProcessExecutor = new LocalProcessExecutor()): QualityCoordinator {
  const providers = config.checkers.test.enabled
    ? [new TestEvidenceProvider(new TestChecker(executor, config))]
    : [];
  return new QualityCoordinator({
    tracker: new ChangeTracker(),
    snapshotter: new GitWorkspaceSnapshotter(),
    planner: new DeterministicQualityPlanner(),
    providers,
    store: new InMemoryEvidenceStore(),
    evaluator: new GateEvaluator(config.mode),
    mode: config.mode,
    repair: {
      enabled: config.repair.enabled,
      maxSteersPerChangeSet: config.repair.maxAttempts,
      stopAfterSameFailure: config.repair.maxSameFailure
    },
    autoExecuteMissingEvidence: config.gate.autoExecuteMissingEvidence
  });
}
