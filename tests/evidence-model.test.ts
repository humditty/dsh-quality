import assert from "node:assert/strict";
import test from "node:test";
import { digest } from "../src/utils/digest.js";
import type { GateResult } from "../src/model/gate-result.js";
import type { QualityEvidence } from "../src/model/quality-evidence.js";

test("digest is stable when object key order differs", () => {
  assert.equal(digest({ b: 2, a: ["x", "y"] }), digest({ a: ["x", "y"], b: 2 }));
  assert.notEqual(digest({ a: 1 }), digest({ a: 2 }));
});

test("evidence outcome and gate completeness are independent", () => {
  const evidence: QualityEvidence = {
    id: "evidence-1",
    obligationId: "test:full",
    kind: "test",
    producer: { id: "test" },
    outcome: "ERROR",
    scope: ["."],
    inputDigest: "input",
    planDigest: "plan",
    observedAt: new Date(),
    durationMs: 1,
    provenance: { commandId: "npm test", cwd: ".", timedOut: false },
    summary: "command missing",
    issues: []
  };
  const result: GateResult = {
    verdict: "BLOCK",
    completeness: "INCOMPLETE",
    reasons: [{ code: "PROVIDER_ERROR", message: evidence.summary }],
    evidence: [evidence]
  };
  assert.equal(result.evidence[0].outcome, "ERROR");
  assert.equal(result.completeness, "INCOMPLETE");
});
