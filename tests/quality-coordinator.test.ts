import assert from "node:assert/strict";
import test from "node:test";
import { ChangeTracker } from "../src/change/change-tracker.js";
import { InMemoryEvidenceStore } from "../src/evidence/evidence-store.js";
import { GateEvaluator } from "../src/gate/gate-evaluator.js";
import { QualityCoordinator } from "../src/gate/quality-coordinator.js";
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
    return { id: `evidence-${this.calls}`, obligationId: obligation.id, kind: "test", producer: { id: "test" }, outcome: this.outcome, scope: obligation.scope, inputDigest: obligation.inputDigest, planDigest: plan.digest, observedAt: new Date(), durationMs: 1, provenance: { commandId: "test", cwd: context.projectRoot, timedOut: false }, summary: this.outcome, issues: [] };
  }
}

function coordinator(provider: FakeProvider, mode: "advisory" | "gate" | "strict" = "gate") {
  const tracker = new ChangeTracker();
  const result = new QualityCoordinator({ tracker, planner: new DeterministicQualityPlanner(), providers: [provider], store: new InMemoryEvidenceStore(), evaluator: new GateEvaluator(mode), mode, repair: { enabled: true, maxSteersPerChangeSet: 2, stopAfterSameFailure: 2 } });
  return { tracker, result };
}

test("coordinator runs missing evidence once and reuses fresh evidence", async () => {
  const provider = new FakeProvider();
  const { tracker, result } = coordinator(provider);
  tracker.observe({ agentId: "agent", projectRoot: "/project", changedFiles: ["src/a.ts"], success: true });
  const first = await result.gate({ agentId: "agent", projectRoot: "/project", changedFiles: ["src/a.ts"] });
  const second = await result.gate({ agentId: "agent", projectRoot: "/project", changedFiles: ["src/a.ts"] });
  assert.equal(first.result.verdict, "ALLOW");
  assert.equal(second.result.verdict, "ALLOW");
  assert.equal(provider.calls, 1);
});

test("coordinator re-runs once after relevant input changes", async () => {
  const provider = new FakeProvider();
  const { tracker, result } = coordinator(provider);
  tracker.observe({ agentId: "agent", projectRoot: "/project", changedFiles: ["src/a.ts"], success: true });
  await result.gate({ agentId: "agent", projectRoot: "/project", changedFiles: [] });
  tracker.observe({ agentId: "agent", projectRoot: "/project", changedFiles: ["src/a.ts"], success: true });
  await result.gate({ agentId: "agent", projectRoot: "/project", changedFiles: [] });
  assert.equal(provider.calls, 2);
});

test("failed evidence blocks and stops steering after the same failure recurs", async () => {
  const provider = new FakeProvider("FAIL");
  const { tracker, result } = coordinator(provider);
  tracker.observe({ agentId: "agent", projectRoot: "/project", changedFiles: ["src/a.ts"], success: true });
  const first = await result.gate({ agentId: "agent", projectRoot: "/project", changedFiles: [] });
  const second = await result.gate({ agentId: "agent", projectRoot: "/project", changedFiles: [] });
  assert.equal(first.result.verdict, "BLOCK");
  assert.equal(first.shouldSteer, true);
  assert.equal(second.shouldSteer, false);
  assert.ok(second.result.reasons.some((reason) => reason.code === "REPAIR_LIMIT_REACHED"));
  assert.equal(provider.calls, 1);
});
