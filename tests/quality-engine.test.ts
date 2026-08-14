import assert from "node:assert/strict";
import test from "node:test";
import { QualityEngine } from "../src/engine/quality-engine.js";
import type { QualityChecker } from "../src/checkers/checker.js";
import { DefaultQualityPolicy } from "../src/policy/default-policy.js";

const context = { projectRoot: ".", changedFiles: ["src/a.ts"] };

function checker(status: "PASS" | "FAIL", supports = true): QualityChecker {
  return {
    id: `checker-${status}`,
    name: "Test checker",
    supports: () => supports,
    check: async () => ({ checkerId: `checker-${status}`, status, summary: status, durationMs: 1 })
  };
}

test("engine executes supported checkers sequentially and aggregates", async () => {
  const engine = new QualityEngine([checker("PASS"), checker("FAIL"), checker("PASS", false)], new DefaultQualityPolicy());
  const result = await engine.run(context);
  assert.equal(result.status, "FAIL");
  assert.equal(result.results.length, 3);
  assert.equal(result.results[2].status, "SKIPPED");
  assert.equal(engine.getLastRun()?.status, "COMPLETED");
  assert.equal(engine.isActive(), false);
});

test("engine converts checker exceptions into a failed run", async () => {
  const bad: QualityChecker = { id: "bad", name: "Bad", supports: () => true, check: async () => { throw new Error("boom"); } };
  const result = await new QualityEngine([bad], new DefaultQualityPolicy()).run(context);
  assert.equal(result.status, "FAIL");
  assert.match(result.summary, /boom/);
});
