import test from "node:test";
import assert from "node:assert/strict";

test("intentional failure for the Quality Gate demo", () => {
  assert.equal(2 + 2, 5);
});
