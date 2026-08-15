import assert from "node:assert/strict";
import test from "node:test";
import { TestEvidenceProvider } from "../src/providers/test-evidence-provider.js";
import type { QualityPlan, VerificationObligation } from "../src/model/quality-plan.js";

const obligation: VerificationObligation = { id: "test:full", kind: "test", required: true, scope: ["."], inputDigest: "input", reason: "source changed" };
const plan: QualityPlan = { id: "plan", changeSetId: "change", digest: "plan", obligations: [obligation], createdAt: new Date() };

test("TestEvidenceProvider converts test results into evidence with provenance", async () => {
  const checker = {
    id: "test",
    check: async () => ({
      checkerId: "test", status: "FAIL" as const, summary: "node tests failed", durationMs: 25,
      details: { command: "npm test", exitCode: 1, timedOut: false, stdout: "", stderr: "assertion failed" },
      issues: []
    })
  };
  const provider = new TestEvidenceProvider(checker);
  const result = await provider.collect(obligation, plan, { projectRoot: "/project", changedFiles: ["src/a.ts"] });
  assert.equal(result.outcome, "FAIL");
  assert.equal(result.provenance.commandId, "npm test");
  assert.equal(result.provenance.exitCode, 1);
  assert.equal(result.inputDigest, obligation.inputDigest);
});
