import assert from "node:assert/strict";
import test from "node:test";
import { FeedbackComposer, truncateFeedback } from "../src/feedback/feedback-composer.js";
import { RepairLoopController } from "../src/repair/repair-controller.js";
import { createQualityState } from "../src/repair/repair-state.js";
import type { VerificationEvidence } from "../src/evidence/verification-evidence.js";

const config = { enabled: true, maxAttempts: 4, maxSameFailure: 2 };
const failed = (fingerprint = "same"): VerificationEvidence => ({
  id: Math.random().toString(), type: "COMMAND", producer: "test", workspaceFingerprint: "workspace", command: "npm test", status: "FAIL", exitCode: 1,
  startedAt: 1, finishedAt: 2, durationMs: 1, stderr: "failure", failureFingerprint: fingerprint
});

test("repair loop counts changed failures as progress and repeated failures as terminal", () => {
  const controller = new RepairLoopController(config);
  const state = createQualityState();
  assert.equal(controller.recordFailure(state, failed("a")).terminal, false);
  assert.equal(state.sameFailureCount, 1);
  assert.equal(controller.recordFailure(state, failed("b")).terminal, false);
  assert.equal(state.sameFailureCount, 1);
  assert.equal(state.repairAttempts, 2);
  assert.equal(controller.recordFailure(state, failed("b")).terminal, true);
  assert.equal(state.terminalFailureMode, true);
});

test("feedback is structured and bounded", () => {
  const state = createQualityState();
  state.repairAttempts = 2;
  state.sameFailureCount = 2;
  const feedback = new FeedbackComposer({ stdoutTail: 3, stderrTail: 5, maxChars: 500 }, config).compose({ ...failed(), stdout: "123456", stderr: "abcdef" }, state, true);
  assert.match(feedback, /stopped automatic repair/);
  assert.match(feedback, /Repair attempt: 2 \/ 4/);
  assert.match(feedback, /bcdef/);
  assert.equal(truncateFeedback("x".repeat(100), 20).length, 20);
});
