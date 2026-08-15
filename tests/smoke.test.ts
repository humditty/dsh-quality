import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CONFIG, DefaultQualityPolicy } from "../src/index.js";

test("package exports the v0.2 building blocks", () => {
  assert.equal(DEFAULT_CONFIG.version, 2);
  assert.equal(new DefaultQualityPolicy().evaluate([], { projectRoot: ".", changedFiles: [] }).status, "WARN");
});
