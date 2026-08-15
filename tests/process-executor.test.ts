import assert from "node:assert/strict";
import test from "node:test";
import { LocalProcessExecutor } from "../src/execution/local-process-executor.js";

const executor = new LocalProcessExecutor();
const base = { cwd: process.cwd(), timeoutMs: 2_000 };

test("LocalProcessExecutor captures successful output", async () => {
  const result = await executor.execute("printf hello", base);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "hello");
  assert.equal(result.timedOut, false);
});

test("LocalProcessExecutor captures non-zero exit", async () => {
  const result = await executor.execute("printf failure >&2; exit 7", base);
  assert.equal(result.exitCode, 7);
  assert.match(result.stderr, /failure/);
});

test("LocalProcessExecutor marks a timeout", async () => {
  const result = await executor.execute("sleep 1", { ...base, timeoutMs: 30 });
  assert.equal(result.timedOut, true);
  assert.notEqual(result.exitCode, 0);
});

test("LocalProcessExecutor bounds output while the process is running", async () => {
  const result = await executor.execute("node -e \"process.stdout.write('x'.repeat(10000)); process.stderr.write('y'.repeat(10000))\"", {
    ...base,
    maxStdoutChars: 80,
    maxStderrChars: 80
  });
  assert.ok(result.stdout.length <= 80);
  assert.ok(result.stderr.length <= 80);
  assert.match(result.stdout, /truncated during execution/);
  assert.match(result.stderr, /truncated during execution/);
});

test("LocalProcessExecutor terminates a process when its signal is aborted", async () => {
  const controller = new AbortController();
  const running = executor.execute("sleep 1", { ...base, timeoutMs: 2_000, signal: controller.signal, killGraceMs: 10 });
  setTimeout(() => controller.abort(), 30);
  const result = await running;
  assert.equal(result.aborted, true);
  assert.equal(result.timedOut, false);
  assert.notEqual(result.exitCode, 0);
});
