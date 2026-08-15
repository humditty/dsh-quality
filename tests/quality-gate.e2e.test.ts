import assert from "node:assert/strict";
import test from "node:test";
import { FeedbackComposer } from "../src/feedback/feedback-composer.js";
import { QualityGate } from "../src/gate/quality-gate.js";
import { RepairLoopController, type RepairLoopConfig } from "../src/repair/repair-controller.js";
import type { CommandVerifier } from "../src/verification/command-verifier.js";
import type { VerificationEvidence, VerificationStatus } from "../src/evidence/verification-evidence.js";
import type { WorkspaceFingerprinter } from "../src/workspace/workspace-fingerprinter.js";

const repair: RepairLoopConfig = { enabled: true, maxAttempts: 4, maxSameFailure: 2 };

class MutableFingerprinter implements WorkspaceFingerprinter {
  constructor(public current = "A") {}
  async fingerprint(): Promise<string> { return this.current; }
}

class FakeVerifier implements CommandVerifier {
  calls = 0;
  constructor(
    private readonly outcomes: Array<{ status: VerificationStatus; failure?: string }>,
    private readonly afterVerify?: (call: number) => void
  ) {}

  async verify(_context: { projectRoot: string; changedFiles: string[] }, workspaceFingerprint: string): Promise<VerificationEvidence> {
    const call = this.calls++;
    this.afterVerify?.(call);
    const outcome = this.outcomes[Math.min(call, this.outcomes.length - 1)];
    return {
      id: `evidence-${call}`, type: "COMMAND", producer: "test", workspaceFingerprint, command: "npm test", status: outcome.status,
      exitCode: outcome.status === "PASS" ? 0 : 1, startedAt: call, finishedAt: call + 1, durationMs: 1,
      stdout: "test output", stderr: outcome.status === "PASS" ? "" : `failure ${outcome.failure ?? "A"}`,
      failureFingerprint: outcome.failure
    };
  }
}

function gate(fingerprinter: MutableFingerprinter, verifier: FakeVerifier): QualityGate {
  const controller = new RepairLoopController(repair);
  return new QualityGate(fingerprinter, verifier, controller, new FeedbackComposer({ stdoutTail: 3_000, stderrTail: 5_000, maxChars: 8_000 }, repair));
}

const context = { agentId: "agent", projectRoot: "/workspace", changedFiles: [] };

test("E2E 1: a stable passing verification allows normal completion", async () => {
  const verifier = new FakeVerifier([{ status: "PASS" }]);
  const qualityGate = gate(new MutableFingerprinter("A"), verifier);
  assert.equal((await qualityGate.gate(context)).verdict, "ALLOW");
  assert.equal((await qualityGate.gate(context)).verdict, "ALLOW");
  assert.equal(verifier.calls, 1);
});

test("E2E 2: a changed workspace invalidates old passing evidence", async () => {
  const fingerprinter = new MutableFingerprinter("A");
  const verifier = new FakeVerifier([{ status: "PASS" }, { status: "PASS" }]);
  const qualityGate = gate(fingerprinter, verifier);
  await qualityGate.gate(context);
  fingerprinter.current = "B";
  const result = await qualityGate.gate(context);
  assert.equal(result.verdict, "ALLOW");
  assert.equal(result.evidence?.workspaceFingerprint, "B");
  assert.equal(verifier.calls, 2);
});

test("E2E 3: a repaired workspace resets repair state after passing", async () => {
  const fingerprinter = new MutableFingerprinter("A");
  const verifier = new FakeVerifier([{ status: "FAIL", failure: "A" }, { status: "PASS" }]);
  const qualityGate = gate(fingerprinter, verifier);
  const failed = await qualityGate.gate(context);
  assert.equal(failed.verdict, "BLOCK");
  fingerprinter.current = "B";
  const passed = await qualityGate.gate(context);
  assert.equal(passed.verdict, "ALLOW");
  assert.equal(passed.state.repairAttempts, 0);
  assert.equal(passed.state.sameFailureCount, 0);
});

test("E2E 4: a changed failure still permits repair", async () => {
  const fingerprinter = new MutableFingerprinter("A");
  const verifier = new FakeVerifier([{ status: "FAIL", failure: "A" }, { status: "FAIL", failure: "B" }]);
  const qualityGate = gate(fingerprinter, verifier);
  await qualityGate.gate(context);
  fingerprinter.current = "B";
  const result = await qualityGate.gate(context);
  assert.equal(result.verdict, "BLOCK");
  assert.equal(result.shouldSteer, true);
  assert.equal(result.state.repairAttempts, 2);
  assert.equal(result.state.sameFailureCount, 1);
});

test("E2E 5: a repeated failure stops automatic repair then allows an honest final turn", async () => {
  const verifier = new FakeVerifier([{ status: "FAIL", failure: "A" }]);
  const qualityGate = gate(new MutableFingerprinter("A"), verifier);
  const first = await qualityGate.gate(context);
  const repeated = await qualityGate.gate(context);
  const final = await qualityGate.gate(context);
  assert.equal(first.shouldSteer, true);
  assert.equal(repeated.verdict, "BLOCK");
  assert.equal(repeated.shouldSteer, true);
  assert.match(repeated.feedback ?? "", /stopped automatic repair/);
  assert.equal(final.verdict, "ALLOW");
  assert.equal(final.shouldSteer, false);
});

test("verification re-runs once when its command changes the workspace", async () => {
  const fingerprinter = new MutableFingerprinter("A");
  const verifier = new FakeVerifier([{ status: "PASS" }, { status: "PASS" }], (call) => {
    if (call === 0) fingerprinter.current = "B";
  });
  const result = await gate(fingerprinter, verifier).gate(context);
  assert.equal(result.verdict, "ALLOW");
  assert.equal(result.evidence?.workspaceFingerprint, "B");
  assert.equal(verifier.calls, 2);
});
