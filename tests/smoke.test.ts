import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CONFIG, DefaultQualityPolicy } from "../src/index.js";

test("package exports the v0.1 building blocks", () => {
  assert.equal(DEFAULT_CONFIG.version, 1);
  assert.equal(new DefaultQualityPolicy().evaluate([], { projectRoot: ".", changedFiles: [] }).status, "WARN");
});
