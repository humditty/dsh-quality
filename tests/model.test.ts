import assert from "node:assert/strict";
import test from "node:test";
import type { QualityRun } from "../src/model/quality-run.js";

test("QualityRun starts in PENDING with an empty check list", () => {
  const run: QualityRun = {
    id: "run-1",
    startedAt: new Date("2026-01-01T00:00:00Z"),
    status: "PENDING",
    context: { projectRoot: "/tmp/project", changedFiles: ["src/index.ts"] },
    checks: []
  };
  assert.equal(run.status, "PENDING");
  assert.deepEqual(run.checks, []);
  assert.equal(run.context.changedFiles[0], "src/index.ts");
});
