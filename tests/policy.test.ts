import assert from "node:assert/strict";
import test from "node:test";
import { DefaultQualityPolicy } from "../src/policy/default-policy.js";
import type { CheckResult } from "../src/model/check-result.js";
import { DEFAULT_CONFIG } from "../src/config/config.js";

const check = (status: CheckResult["status"]): CheckResult => ({ checkerId: "test", status, summary: status, durationMs: 1 });
const context = { projectRoot: ".", changedFiles: [] };

test("default policy applies FAIL over WARN and PASS", () => {
  const policy = new DefaultQualityPolicy();
  assert.equal(policy.evaluate([check("PASS")], context).status, "PASS");
  assert.equal(policy.evaluate([check("WARN")], context).status, "WARN");
  assert.equal(policy.evaluate([check("FAIL")], context).status, "FAIL");
  assert.equal(policy.evaluate([check("ERROR")], context).status, "FAIL");
  assert.equal(policy.evaluate([check("WARN"), check("FAIL")], context).status, "FAIL");
  assert.equal(policy.evaluate([check("SKIPPED")], context).status, "WARN");
});

test("policy configuration can downgrade test failures and checker errors", () => {
  const config = { ...DEFAULT_CONFIG, policy: { failOnTestFailure: false, failOnCheckerError: false } };
  const policy = new DefaultQualityPolicy(config);
  assert.equal(policy.evaluate([check("FAIL")], context).status, "WARN");
  assert.equal(policy.evaluate([check("ERROR")], context).status, "WARN");
});
