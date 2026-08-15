import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DEFAULT_CONFIG } from "../src/config/config.js";
import type { ProcessExecutor, ProcessOptions, ProcessResult } from "../src/execution/process-executor.js";
import { TestChecker, truncateOutput } from "../src/checkers/test/test-checker.js";

class FakeExecutor implements ProcessExecutor {
  public command = "";
  public options?: ProcessOptions;
  constructor(private readonly result: ProcessResult) {}
  async execute(command: string, options: ProcessOptions): Promise<ProcessResult> {
    this.command = command;
    this.options = options;
    return this.result;
  }
}

async function project(marker: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dsh-quality-project-"));
  await writeFile(join(root, marker), "");
  return root;
}

const result = (overrides: Partial<ProcessResult> = {}): ProcessResult => ({ exitCode: 0, stdout: "ok", stderr: "", durationMs: 12, timedOut: false, aborted: false, ...overrides });

test("detects supported project types and resolves commands", async () => {
  const cases = [
    ["pom.xml", "mvn test"],
    ["build.gradle", "gradle test"],
    ["pytest.ini", "pytest"],
    ["package.json", "npm test"]
  ] as const;
  for (const [marker, expectedCommand] of cases) {
    const executor = new FakeExecutor(result());
    const checker = new TestChecker(executor, DEFAULT_CONFIG);
    const check = await checker.check({ projectRoot: await project(marker), changedFiles: [] });
    assert.equal(check.status, "PASS");
    assert.equal(executor.command, expectedCommand);
  }
});

test("maps test failure and timeout to structured results", async () => {
  const root = await project("package.json");
  const failed = await new TestChecker(new FakeExecutor(result({ exitCode: 1, stderr: "assertion failed" })), DEFAULT_CONFIG).check({ projectRoot: root, changedFiles: [] });
  assert.equal(failed.status, "FAIL");
  assert.equal((failed.details as { exitCode: number }).exitCode, 1);
  const timeout = await new TestChecker(new FakeExecutor(result({ timedOut: true, exitCode: 124 })), DEFAULT_CONFIG).check({ projectRoot: root, changedFiles: [] });
  assert.equal(timeout.status, "ERROR");
});

test("passes cancellation through to the executor", async () => {
  const controller = new AbortController();
  const executor = new FakeExecutor(result());
  await new TestChecker(executor, DEFAULT_CONFIG).check({ projectRoot: await project("package.json"), changedFiles: [], signal: controller.signal });
  assert.equal(executor.options?.signal, controller.signal);
});

test("truncates output while retaining both ends", () => {
  const output = "0123456789".repeat(20);
  const truncated = truncateOutput(output, 40);
  assert.ok(truncated.length <= 40);
  assert.match(truncated, /^0123/);
  assert.match(truncated, /6789$/);
  assert.match(truncated, /truncated/);
});
