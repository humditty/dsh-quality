import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadConfig } from "../src/config/config-loader.js";

test("loadConfig uses defaults when no file exists", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-quality-config-"));
  const config = await loadConfig(root);
  assert.equal(config.checkers.test.timeout, 120_000);
  assert.equal(config.output.maxStdoutChars, 10_000);
});

test("loadConfig reads yaml seconds and applies overrides", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-quality-config-"));
  await writeFile(join(root, ".dsh-quality.yaml"), [
    "version: 1",
    "mode: strict",
    "checkers:",
    "  test:",
    "    enabled: false",
    "    timeout: 3",
    "report:",
    "  markdown: false",
    "output:",
    "  max_stdout_chars: 20",
    "gate:",
    "  auto_execute_missing_evidence: false",
    "repair:",
    "  max_attempts: 5",
    "feedback:",
    "  max_chars: 200",
    ""
  ].join("\n"));
  const config = await loadConfig(root, { timeout: 5_000, markdownPath: "custom.md" });
  assert.equal(config.checkers.test.enabled, false);
  assert.equal(config.mode, "strict");
  assert.equal(config.checkers.test.timeout, 5_000);
  assert.equal(config.report.markdown, false);
  assert.equal(config.report.markdownPath, "custom.md");
  assert.equal(config.output.maxStdoutChars, 20);
  assert.equal(config.gate.autoExecuteMissingEvidence, false);
  assert.equal(config.repair.maxAttempts, 5);
  assert.equal(config.feedback.maxChars, 200);
});
