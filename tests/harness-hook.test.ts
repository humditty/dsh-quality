import assert from "node:assert/strict";
import test from "node:test";
import { QualityEngine } from "../src/engine/quality-engine.js";
import type { QualityChecker } from "../src/checkers/checker.js";
import { DefaultQualityPolicy } from "../src/policy/default-policy.js";
import { HarnessHook } from "../src/hooks/harness-hook.js";

const passingChecker: QualityChecker = {
  id: "test",
  name: "Test",
  supports: () => true,
  check: async () => ({ checkerId: "test", status: "PASS", summary: "passed", durationMs: 1 })
};

test("HarnessHook triggers only for successful code changes", async () => {
  const feedback: string[] = [];
  const hook = new HarnessHook(new QualityEngine([passingChecker], new DefaultQualityPolicy()), (message) => feedback.push(message));
  const base = { type: "tools/post-execute", success: true, changedFiles: ["src/a.ts"], projectRoot: "." };
  assert.equal((await hook.handle({ ...base, success: false })), undefined);
  assert.equal((await hook.handle({ ...base, changedFiles: ["README.md"] })), undefined);
  const result = await hook.handle(base);
  assert.equal(result?.status, "PASS");
  assert.match(feedback[0], /Quality Gate PASS/);
});

test("HarnessHook ignores self-generated and active-run events", async () => {
  const engine = new QualityEngine([passingChecker], new DefaultQualityPolicy());
  const hook = new HarnessHook(engine);
  const base = { type: "tools/post-execute", success: true, changedFiles: ["src/a.ts"], projectRoot: "." };
  assert.equal(await hook.handle({ ...base, metadata: { source: "dsh-quality" } }), undefined);
  assert.equal(await hook.handle({ ...base, metadata: { qualityRunActive: true } }), undefined);
});
