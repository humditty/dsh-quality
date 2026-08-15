import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DEFAULT_CONFIG } from "../src/config/config.js";
import { createDefaultQualityGate } from "../src/gate/default-quality-gate.js";
import type { ProcessExecutor, ProcessOptions, ProcessResult } from "../src/execution/process-executor.js";

class PassingExecutor implements ProcessExecutor {
  calls = 0;
  async execute(_command: string, _options: ProcessOptions): Promise<ProcessResult> {
    this.calls += 1;
    return { exitCode: 0, stdout: "passed", stderr: "", durationMs: 1, timedOut: false, aborted: false };
  }
}

function git(root: string, args: string[]): void {
  execFileSync("git", ["-C", root, ...args], { stdio: "ignore" });
}

test("default gate binds a passing command to the Git workspace fingerprint", async () => {
  const root = mkdtempSync(join(tmpdir(), "dsh-quality-default-gate-"));
  try {
    git(root, ["init"]);
    git(root, ["config", "user.name", "DSH Quality Test"]);
    git(root, ["config", "user.email", "test@example.invalid"]);
    writeFileSync(join(root, "package.json"), "{\"scripts\":{\"test\":\"node test.js\"}}\n");
    writeFileSync(join(root, "test.js"), "process.exit(0);\n");
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "initial"]);
    const executor = new PassingExecutor();
    const qualityGate = createDefaultQualityGate(DEFAULT_CONFIG, executor);

    assert.equal((await qualityGate.gate({ projectRoot: root, changedFiles: [] })).verdict, "ALLOW");
    assert.equal((await qualityGate.gate({ projectRoot: root, changedFiles: [] })).verdict, "ALLOW");
    assert.equal(executor.calls, 1);

    writeFileSync(join(root, "test.js"), "process.exit(0); // changed\n");
    assert.equal((await qualityGate.gate({ projectRoot: root, changedFiles: [] })).verdict, "ALLOW");
    assert.equal(executor.calls, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
