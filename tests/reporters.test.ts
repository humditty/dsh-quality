import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ConsoleReporter } from "../src/reporters/console-reporter.js";
import { MarkdownReporter } from "../src/reporters/markdown-reporter.js";
import type { QualityResult } from "../src/model/quality-result.js";

const result: QualityResult = {
  runId: "run-1",
  status: "FAIL",
  results: [{ checkerId: "test", status: "FAIL", summary: "tests failed", durationMs: 1200 }],
  summary: "tests failed",
  startedAt: new Date(),
  finishedAt: new Date(),
  durationMs: 1200
};

test("ConsoleReporter emits gate status and check summary", async () => {
  let output = "";
  await new ConsoleReporter((message) => { output = message; }).report(result);
  assert.match(output, /Quality Gate: FAIL/);
  assert.match(output, /tests failed/);
});

test("MarkdownReporter writes a readable report", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-quality-report-"));
  const file = join(root, "quality-report.md");
  await new MarkdownReporter(file).report(result);
  const markdown = await readFile(file, "utf8");
  assert.match(markdown, /# DSH Quality Report/);
  assert.match(markdown, /\| test \| FAIL \| tests failed/);
});
