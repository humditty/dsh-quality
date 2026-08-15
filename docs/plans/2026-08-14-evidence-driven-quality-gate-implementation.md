# Evidence-driven Quality Gate Implementation Plan

> 状态：已按此计划完成核心实现；最终验证与文档同步中。v0.1 CLI 保留为兼容路径，未迁移为 v0.2 的主动 `quality_check` 命令。

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the immediate-on-change Hook path with an evidence-driven terminal gate that plans deterministic test obligations, reuses fresh evidence, and bounds automatic repair steering.

**Architecture:** Keep the existing v0.1 CLI and process executor as compatibility adapters while introducing a v0.2 core: `ChangeTracker → Planner → EvidenceProvider → EvidenceStore → GateEvaluator → QualityCoordinator`. The Hook observes tool results cheaply and invokes the coordinator only at `agent/turn-stopping`.

**Tech Stack:** Node.js, TypeScript, built-in `node:test`, existing local process executor and YAML configuration.

---

### Task 1: Add v0.2 domain models and deterministic digest utilities

**Files:**
- Create: `src/model/change-set.ts`
- Create: `src/model/quality-evidence.ts`
- Create: `src/model/quality-plan.ts`
- Create: `src/model/gate-result.ts`
- Create: `src/utils/digest.ts`
- Modify: `src/index.ts`
- Test: `tests/evidence-model.test.ts`

**Step 1:** Write tests for stable input/plan digests and distinct evidence outcome, freshness, verdict, and completeness states.

**Step 2:** Run the new test and confirm it fails because v0.2 modules do not exist.

**Step 3:** Add minimal interfaces and deterministic SHA-256 JSON digest helper.

**Step 4:** Re-run the focused test and confirm it passes.

### Task 2: Build change classification and deterministic Planner

**Files:**
- Create: `src/change/change-tracker.ts`
- Create: `src/planning/quality-planner.ts`
- Test: `tests/quality-planner.test.ts`

**Step 1:** Test docs-only, source/test, build-file, and unknown/low-confidence change sets.

**Step 2:** Implement path classification and a planner that creates no obligation for docs-only changes and one full-test obligation otherwise.

**Step 3:** Make plan and obligation input digests deterministic.

**Step 4:** Run focused planner tests.

### Task 3: Adapt TestChecker into an EvidenceProvider and create an evidence store

**Files:**
- Create: `src/providers/evidence-provider.ts`
- Create: `src/providers/test-evidence-provider.ts`
- Create: `src/evidence/evidence-store.ts`
- Test: `tests/evidence-store.test.ts`
- Test: `tests/test-evidence-provider.test.ts`

**Step 1:** Test fresh evidence lookup, stale evidence rejection, and TestChecker result conversion.

**Step 2:** Implement an in-memory store indexed by obligation id and input/plan digest.

**Step 3:** Adapt the existing injected TestChecker without duplicating shell command logic.

**Step 4:** Run focused provider and store tests.

### Task 4: Implement evaluator, bounded coordinator, and repair controller

**Files:**
- Create: `src/gate/gate-evaluator.ts`
- Create: `src/gate/repair-controller.ts`
- Create: `src/gate/quality-coordinator.ts`
- Modify: `src/config/config.ts`
- Modify: `src/config/config-loader.ts`
- Test: `tests/gate-evaluator.test.ts`
- Test: `tests/quality-coordinator.test.ts`

**Step 1:** Write tests for missing, stale, failed, and errored evidence in advisory/gate/strict modes.

**Step 2:** Implement coordinator behavior: evaluate first, execute missing/stale obligations once per ChangeSet and plan, then evaluate again.

**Step 3:** Add repair budgets keyed by agent, ChangeSet, and normalized failure signature.

**Step 4:** Run focused gate tests.

### Task 5: Replace immediate Hook execution with terminal Gate behavior

**Files:**
- Modify: `src/hooks/harness-hook.ts`
- Modify: `src/index.ts`
- Modify: `tests/harness-hook.test.ts`

**Step 1:** Test that `tools/result` observes changes without invoking the provider.

**Step 2:** Test that `agent/turn-stopping` invokes the coordinator, emits feedback only for BLOCK, and stops steering after the repair budget.

**Step 3:** Keep legacy `tools/post-execute` support as an observation alias, not a test trigger.

**Step 4:** Run focused Hook tests.

### Task 6: Document migration and verify behavior

**Files:**
- Modify: `README.md`
- Modify: `.dsh-quality.yaml`
- Test: all existing tests

**Step 1:** Document v0.2 lifecycle and configuration defaults without claiming unimplemented AI/affected-test support.

**Step 2:** Run `npm run typecheck` and `npm test`.

**Step 3:** Run the CLI against PASS and FAIL Node examples to confirm v0.1 CLI compatibility.

**Step 4:** Review the final diff; preserve unrelated `.workbuddy/` files and do not commit without an explicit request.
