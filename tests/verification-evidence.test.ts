import assert from "node:assert/strict";
import test from "node:test";
import { createFailureFingerprint, normalizeFailureOutput } from "../src/evidence/failure-fingerprint.js";
import { isFresh } from "../src/evidence/freshness.js";
import type { VerificationEvidence } from "../src/evidence/verification-evidence.js";
import { TestCommandVerifier } from "../src/verification/command-verifier.js";

function evidence(overrides: Partial<VerificationEvidence> = {}): VerificationEvidence {
  return {
    id: "evidence-1", type: "COMMAND", producer: "test", workspaceFingerprint: "workspace-a", command: "npm test", status: "PASS",
    startedAt: 1, finishedAt: 2, durationMs: 1, ...overrides
  };
}

test("only passing evidence for the current workspace is fresh", () => {
  assert.equal(isFresh(evidence(), "workspace-a"), true);
  assert.equal(isFresh(evidence(), "workspace-b"), false);
  assert.equal(isFresh(evidence({ status: "FAIL" }), "workspace-a"), false);
});

test("failure fingerprints ignore timestamps, UUIDs, temporary paths, and ANSI color", () => {
  const first = evidence({ status: "FAIL", exitCode: 1, stderr: "\u001b[31m2026-08-15T12:00:00Z /tmp/run-a 9cf7a6c5-a111-4f87-9b38-cf69a6b14b36 failed\u001b[0m" });
  const second = evidence({ status: "FAIL", exitCode: 1, stderr: "2026-08-16T09:00:00Z /private/tmp/run-b 4773ac08-8c8e-4dde-910a-f7e65b1d8263 failed" });
  assert.equal(createFailureFingerprint(first), createFailureFingerprint(second));
  assert.equal(normalizeFailureOutput("a\n\n b"), "a b");
});

test("command verifier preserves command output and attaches a failure fingerprint", async () => {
  const verifier = new TestCommandVerifier({
    id: "test",
    async check() {
      return { checkerId: "test", status: "FAIL", summary: "failed", durationMs: 12, details: { command: "npm test", exitCode: 1, stdout: "out", stderr: "err" } };
    }
  });
  const result = await verifier.verify({ projectRoot: "/project", changedFiles: [] }, "workspace-a");
  assert.equal(result.status, "FAIL");
  assert.equal(result.command, "npm test");
  assert.equal(result.stderr, "err");
  assert.ok(result.failureFingerprint);
});
