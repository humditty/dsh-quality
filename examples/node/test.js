import test from "node:test";
import assert from "node:assert/strict";

function divide(a, b) {
  if (b === 0) throw new Error("cannot divide by zero");
  return a / b;
}

test("divide returns a quotient", () => assert.equal(divide(6, 2), 3));
test("divide rejects zero", () => assert.throws(() => divide(1, 0), /cannot divide by zero/));
