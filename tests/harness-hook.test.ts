import assert from "node:assert/strict";
import test from "node:test";
import { ChangeTracker } from "../src/change/change-tracker.js";
import { InMemoryEvidenceStore } from "../src/evidence/evidence-store.js";
import { GateEvaluator } from "../src/gate/gate-evaluator.js";
import { QualityCoordinator } from "../src/gate/quality-coordinator.js";
import { HarnessHook } from "../src/hooks/harness-hook.js";
import type { QualityContext } from "../src/model/quality-context.js";
import type { QualityEvidence } from "../src/model/quality-evidence.js";
import type { QualityPlan, VerificationObligation } from "../src/model/quality-plan.js";
import { DeterministicQualityPlanner } from "../src/planning/quality-planner.js";
import type { EvidenceProvider } from "../src/providers/evidence-provider.js";

class FakeProvider implements EvidenceProvider {
  readonly id = "test";
  readonly kind = "test" as const;
  calls = 0;
  constructor(private readonly outcome: QualityEvidence["outcome"] = "PASS") {}
  supports(): boolean { return true; }
  async collect(obligation: VerificationObligation, plan: QualityPlan, context: QualityContext): Promise<QualityEvidence> {
    this.calls += 1;
    return { id: String(this.calls), obligationId: obligation.id, kind: "test", producer: { id: "test" }, outcome: this.outcome, scope: obligation.scope, inputDigest: obligation.inputDigest, planDigest: plan.digest, observedAt: new Date(), durationMs: 1, provenance: { commandId: "test", cwd: context.projectRoot, timedOut: false }, summary: this.outcome, issues: [] };
  }
}

function createHook(provider: FakeProvider, feedback: string[], steers: string[]) {
  const coordinator = new QualityCoordinator({
    tracker: new ChangeTracker(), planner: new DeterministicQualityPlanner(), providers: [provider], store: new InMemoryEvidenceStore(), evaluator: new GateEvaluator("gate"), mode: "gate",
    repair: { enabled: true, maxSteersPerChangeSet: 2, stopAfterSameFailure: 2 }
  });
  return new HarnessHook(coordinator, (message) => feedback.push(message), (message) => steers.push(message));
}

const event = { projectRoot: "/project", agentId: "agent", changedFiles: ["src/a.ts"], success: true };

test("Hook observes tool results but performs verification only at turn stopping", async () => {
  const provider = new FakeProvider();
  const feedback: string[] = [];
  const steers: string[] = [];
  const hook = createHook(provider, feedback, steers);
  assert.equal(await hook.handle({ ...event, type: "tools/result" }), undefined);
  assert.equal(provider.calls, 0);
  const result = await hook.handle({ ...event, type: "agent/turn-stopping" });
  assert.equal(result?.verdict, "ALLOW");
  assert.equal(provider.calls, 1);
  assert.deepEqual(feedback, []);
  assert.deepEqual(steers, []);
});

test("Hook feeds back and steers a blocking gate only within repair budget", async () => {
  const provider = new FakeProvider("FAIL");
  const feedback: string[] = [];
  const steers: string[] = [];
  const hook = createHook(provider, feedback, steers);
  await hook.handle({ ...event, type: "tools/post-execute" });
  const first = await hook.handle({ ...event, type: "agent/turn-stopping" });
  const second = await hook.handle({ ...event, type: "agent/turn-stopping" });
  assert.equal(first?.verdict, "BLOCK");
  assert.equal(second?.verdict, "BLOCK");
  assert.equal(feedback.length, 2);
  assert.equal(steers.length, 1);
  assert.match(feedback[0], /Quality Gate BLOCKED/);
  assert.match(feedback[1], /Automatic repair stopped/);
});

test("Hook ignores DSH Quality's own events", async () => {
  const provider = new FakeProvider();
  const hook = createHook(provider, [], []);
  assert.equal(await hook.handle({ ...event, type: "tools/result", metadata: { source: "dsh-quality" } }), undefined);
  assert.equal(provider.calls, 0);
});
