import assert from "node:assert/strict";
import test from "node:test";
import { ChangeTracker, classifyPath } from "../src/change/change-tracker.js";
import { DeterministicQualityPlanner } from "../src/planning/quality-planner.js";

const planner = new DeterministicQualityPlanner();

test("classifies common project paths", () => {
  assert.equal(classifyPath("README.md"), "docs");
  assert.equal(classifyPath("src/user.ts"), "source");
  assert.equal(classifyPath("tests/user.test.ts"), "test");
  assert.equal(classifyPath("package.json"), "build");
  assert.equal(classifyPath("assets/logo.svg"), "unknown");
});

test("planner skips execution for a high-confidence docs-only change set", () => {
  const tracker = new ChangeTracker();
  tracker.observe({ agentId: "agent-1", projectRoot: "/project", changedFiles: ["README.md"], success: true });
  const plan = planner.plan(tracker.snapshot({ agentId: "agent-1", projectRoot: "/project" }));
  assert.equal(plan.obligations.length, 0);
});

test("planner requires a full test for source, build, and low-confidence changes", () => {
  const tracker = new ChangeTracker();
  tracker.observe({ agentId: "source", projectRoot: "/project", changedFiles: ["src/user.ts"], success: true });
  assert.equal(planner.plan(tracker.snapshot({ agentId: "source", projectRoot: "/project" })).obligations[0].id, "test:full");

  tracker.observe({ agentId: "build", projectRoot: "/project", changedFiles: ["package.json"], success: true });
  assert.equal(planner.plan(tracker.snapshot({ agentId: "build", projectRoot: "/project" })).obligations[0].id, "test:full");

  const low = tracker.snapshot({ agentId: "unknown", projectRoot: "/project", confidence: "low" });
  assert.equal(planner.plan(low).obligations[0].id, "test:full");
});

test("unknown mutating tool output produces a conservative plan", () => {
  const tracker = new ChangeTracker();
  tracker.observe({ agentId: "agent", projectRoot: "/project", changedFiles: [], success: true, mayHaveMutated: true });
  const changeSet = tracker.snapshot({ agentId: "agent", projectRoot: "/project" });
  assert.equal(changeSet.confidence, "low");
  assert.equal(planner.plan(changeSet).obligations[0].id, "test:full");
});

test("failed tools still contribute their declared changed files", () => {
  const tracker = new ChangeTracker();
  tracker.observe({ agentId: "agent", projectRoot: "/project", changedFiles: ["src/partial.ts"], success: false, mayHaveMutated: true });
  const changeSet = tracker.snapshot({ agentId: "agent", projectRoot: "/project" });
  const plan = new DeterministicQualityPlanner().plan(changeSet);
  assert.deepEqual(changeSet.entries.map((entry) => entry.path), ["src/partial.ts"]);
  assert.equal(plan.obligations.length, 1);
});

test("planner input digest changes when a tracked path changes", () => {
  const tracker = new ChangeTracker();
  tracker.observe({ agentId: "agent-1", projectRoot: "/project", changedFiles: ["src/user.ts"], success: true });
  const first = planner.plan(tracker.snapshot({ agentId: "agent-1", projectRoot: "/project" }));
  tracker.observe({ agentId: "agent-1", projectRoot: "/project", changedFiles: ["src/user.ts"], success: true });
  const second = planner.plan(tracker.snapshot({ agentId: "agent-1", projectRoot: "/project" }));
  assert.notEqual(first.obligations[0].inputDigest, second.obligations[0].inputDigest);
});

test("unchanged snapshots retain the same change set and plan identity", () => {
  const tracker = new ChangeTracker();
  tracker.observe({ agentId: "agent-1", projectRoot: "/project", changedFiles: ["src/user.ts"], success: true });
  const firstChangeSet = tracker.snapshot({ agentId: "agent-1", projectRoot: "/project" });
  const secondChangeSet = tracker.snapshot({ agentId: "agent-1", projectRoot: "/project" });
  assert.equal(firstChangeSet.id, secondChangeSet.id);
  assert.equal(planner.plan(firstChangeSet).digest, planner.plan(secondChangeSet).digest);
});
