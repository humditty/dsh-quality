import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryEvidenceStore } from "../src/evidence/evidence-store.js";
import type { QualityEvidence } from "../src/model/quality-evidence.js";
import type { QualityPlan, VerificationObligation } from "../src/model/quality-plan.js";

const obligation: VerificationObligation = { id: "test:full", kind: "test", required: true, scope: ["."], inputDigest: "input-a", reason: "source changed" };
const plan: QualityPlan = { id: "plan-a", changeSetId: "change-a", digest: "plan-a", obligations: [obligation], createdAt: new Date() };

function evidence(overrides: Partial<QualityEvidence> = {}): QualityEvidence {
  return {
    id: "evidence-1", obligationId: obligation.id, kind: "test", producer: { id: "test" }, outcome: "PASS", scope: ["."], inputDigest: obligation.inputDigest, planDigest: plan.digest,
    observedAt: new Date(), durationMs: 1, provenance: { commandId: "npm test", cwd: ".", timedOut: false }, summary: "passed", issues: [], ...overrides
  };
}

test("store returns only fresh evidence for the current obligation and plan", () => {
  const store = new InMemoryEvidenceStore();
  store.add(evidence());
  assert.equal(store.find(obligation, plan).freshness, "FRESH");
  assert.equal(store.find(obligation, plan).evidence?.outcome, "PASS");
});

test("store labels mismatched plan or input as stale", () => {
  const store = new InMemoryEvidenceStore();
  store.add(evidence({ inputDigest: "old-input" }));
  assert.equal(store.find(obligation, plan).freshness, "STALE");
  store.add(evidence({ id: "evidence-2", inputDigest: obligation.inputDigest, planDigest: "old-plan" }));
  assert.equal(store.find(obligation, plan).freshness, "STALE");
});
