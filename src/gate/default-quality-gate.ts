import type { QualityConfig } from "../config/config.js";
import { TestChecker } from "../checkers/test/test-checker.js";
import type { ProcessExecutor } from "../execution/process-executor.js";
import { LocalProcessExecutor } from "../execution/local-process-executor.js";
import { FeedbackComposer } from "../feedback/feedback-composer.js";
import { RepairLoopController } from "../repair/repair-controller.js";
import { TestCommandVerifier } from "../verification/command-verifier.js";
import { GitWorkspaceFingerprinter } from "../workspace/git-workspace-fingerprinter.js";
import { QualityGate } from "./quality-gate.js";

export function createDefaultQualityGate(config: QualityConfig, executor: ProcessExecutor = new LocalProcessExecutor()): QualityGate {
  const verifier = new TestCommandVerifier(new TestChecker(executor, config));
  const repair = new RepairLoopController(config.repair);
  return new QualityGate(
    new GitWorkspaceFingerprinter(),
    verifier,
    repair,
    new FeedbackComposer(config.feedback, config.repair)
  );
}
