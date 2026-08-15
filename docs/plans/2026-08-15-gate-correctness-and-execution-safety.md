# Gate Correctness and Execution Safety Implementation Plan

> 状态：已完成（2026-08-15）。全量类型检查、45 个自动化测试和 CLI PASS/FAIL 示例已验证。

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the v0.2 Gate conservative under failed tool calls, real Git workspaces, concurrent verification, and noisy or non-terminating test processes.

**Architecture:** Preserve the existing Observer → Planner → Provider → Evidence → Gate boundaries. Add a Git-aware snapshotter that supplements observer paths, key concurrent Gate work by the immutable ChangeSet/plan identity, and make the local process executor stream only bounded output while supporting cancellation and timeout escalation.

**Tech Stack:** Node.js, TypeScript, built-in `node:test`, Git CLI, `child_process`.

---

### Task 1: Add regression tests for observation and Git snapshots

**Files:**
- Create: `src/change/git-workspace-snapshotter.ts`
- Modify: `src/change/change-tracker.ts`
- Create: `tests/git-workspace-snapshotter.test.ts`
- Modify: `tests/quality-planner.test.ts`

**Steps:**
1. Write a test proving a failed tool result that names a changed file remains part of the ChangeSet.
2. Create a temporary Git repository in a test; modify a tracked file and add an untracked file, then assert the snapshot includes both with content digests.
3. Assert that a missing Git repository falls back to observer paths and is marked low-confidence when a mutation cannot be attributed.
4. Implement the minimal snapshotter and integrate it before planning.

### Task 2: Prevent a Gate from returning stale success

**Files:**
- Modify: `src/gate/quality-coordinator.ts`
- Modify: `src/model/gate-result.ts`
- Modify: `tests/quality-coordinator.test.ts`

**Steps:**
1. Add a provider test double that pauses during collection.
2. Start a Gate, record a second mutation, then release the provider; assert no success result can be returned for the old ChangeSet.
3. Key in-flight work by agent, project root, ChangeSet id, and plan digest rather than only agent/project.
4. Re-snapshot after provider execution; re-plan and collect once for the newer ChangeSet, then return a deterministic BLOCK if the workspace continues changing.

### Task 3: Bound local command execution

**Files:**
- Modify: `src/execution/process-executor.ts`
- Modify: `src/execution/local-process-executor.ts`
- Modify: `tests/process-executor.test.ts`

**Steps:**
1. Add tests that a large stdout/stderr stream is capped during execution and retains a truncation marker.
2. Add an AbortSignal test and a timeout test that exercises termination escalation.
3. Add `signal`, output limits, and kill-grace configuration to process options.
4. Stream output through a bounded collector; on abort/timeout send SIGTERM, then SIGKILL if the process group remains alive.

### Task 4: Wire configuration, document guarantees, and verify

**Files:**
- Modify: `src/config/config.ts`
- Modify: `src/gate/default-coordinator.ts`
- Modify: `README.md`
- Modify: `docs/design/2026-08-14-evidence-driven-quality-gate-v0.2.md`
- Test: all tests

**Steps:**
1. Wire configured output limits and default process behavior into the Test Provider path.
2. Document the Git snapshot fallback, race policy, and command-execution limits without claiming a complete sandbox.
3. Run `npm run typecheck`, `npm test`, and both CLI fixtures.
4. Review staged changes, exclude `.workbuddy/`, commit, and push only after all verification passes.
