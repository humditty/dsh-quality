import assert from "node:assert/strict";
import test from "node:test";
import { parseCliArgs } from "../src/cli.js";

test("parseCliArgs resolves root, timeout, and report file", () => {
  const options = parseCliArgs(["--root", "examples/node", "--timeout", "7", "--report-file", "report.md"], "/workspace/project");
  assert.equal(options.projectRoot, "/workspace/project/examples/node");
  assert.equal(options.timeout, 7_000);
  assert.equal(options.markdownPath, "/workspace/project/examples/node/report.md");
});
