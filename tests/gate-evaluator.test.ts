import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryEvidenceStore } from "../src/evidence/evidence-store.js";
import { GateEvaluator } from "../src/gate/gate-evaluator.js";
import type { ChangeSet } from "../src/model/change-set.js";
import type { QualityEvidence } from "../src/model/quality-evidence.js";
import type { QualityPlan, VerificationObligation } from "../src/model/quality-plan.js";

const changeSet: ChangeSet = { id: "change", projectRoot: ".", base: { capturedAt: new Date() }, entries: [{ path: "src/a.ts", kind: "source", contentDigest: "a" }], confidence: "high", observedAt: new Date() };
const obligation: VerificationObligation = { id: "test:full", kind: "test", required: true, scope: ["."], inputDigest: "input", reason: "source" };
const plan: QualityPlan = { id: "plan", changeSetId: changeSet.id, digest: "plan", obligations: [obligation], createdAt: new Date() };

function evidence(outcome: QualityEvidence["outcome"], overrides: Partial<QualityEvidence> = {}): QualityEvidence {
  return { id: "evidence", obligationId: obligation.id, kind: "test", producer: { id: "test" }, outcome, scope: ["."], inputDigest: "input", planDigest: "plan", observedAt: new Date(), durationMs: 1, provenance: { commandId: "npm test", cwd: ".", timedOut: false }, summary: outcome, issues: [], ...overrides };
}

test("evaluator blocks missing evidence in gate mode and warns in advisory mode", () => {
  const store = new InMemoryEvidenceStore();
  assert.equal(new GateEvaluator("gate").evaluate(changeSet, plan, store).verdict, "BLOCK");
  const advisory = new GateEvaluator("advisory").evaluate(changeSet, plan, store);
  assert.equal(advisory.verdict, "WARN");
  assert.equal(advisory.completeness, "INCOMPLETE");
});

test("evaluator distinguishes a failed test from provider error and stale evidence", () => {
  const store = new InMemoryEvidenceStore();
  store.add(evidence("FAIL"));
  const failed = new GateEvaluator("gate").evaluate(changeSet, plan, store);
  assert.equal(failed.reasons[0].code, "TEST_FAILED");
  assert.equal(failed.completeness, "COMPLETE");

  const errors = new InMemoryEvidenceStore();
  errors.add(evidence("ERROR"));
  const errored = new GateEvaluator("gate").evaluate(changeSet, plan, errors);
  assert.equal(errored.reasons[0].code, "PROVIDER_ERROR");
  assert.equal(errored.completeness, "INCOMPLETE");

  const stale = new InMemoryEvidenceStore();
  stale.add(evidence("PASS", { inputDigest: "old" }));
  assert.equal(new GateEvaluator("gate").evaluate(changeSet, plan, stale).reasons[0].code, "EVIDENCE_STALE");
});

test("strict mode blocks a low-confidence change set even with passing evidence", () => {
  const store = new InMemoryEvidenceStore();
  store.add(evidence("PASS"));
  const result = new GateEvaluator("strict").evaluate({ ...changeSet, confidence: "low" }, plan, store);
  assert.equal(result.verdict, "BLOCK");
  assert.equal(result.reasons[0].code, "CHANGESET_UNVERIFIABLE");
});
