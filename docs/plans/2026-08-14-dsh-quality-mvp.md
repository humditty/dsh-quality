# DSH Quality MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone TypeScript DSH Quality v0.1 package that detects supported projects, runs tests through a timeout-aware executor, applies a quality policy, reports results, and exposes a recursion-safe Harness hook.

**Architecture:** Keep a single package with explicit module boundaries: model/config at the bottom, process execution and TestChecker behind interfaces, QualityEngine as the lifecycle owner, Policy as the decision maker, Reporters as presentation-only adapters, and HarnessHook as an entry point. The CLI uses the same engine as the hook.

**Tech Stack:** Node.js, TypeScript, built-in `node:test`, `tsx`, `yaml`, npm.

---

### Task 1: Bootstrap the package and test tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/index.ts`
- Create: `tests/smoke.test.ts`

**Steps:**
1. Define build, test, CLI, and typecheck scripts.
2. Configure strict TypeScript output to `dist`.
3. Add a smoke test importing the package entry point.
4. Run `npm install` and `npm test` to validate the toolchain.

### Task 2: Add domain models and configuration

**Files:**
- Create: `src/model/quality-context.ts`
- Create: `src/model/quality-issue.ts`
- Create: `src/model/check-result.ts`
- Create: `src/model/quality-result.ts`
- Create: `src/model/quality-run.ts`
- Create: `src/config/config.ts`
- Create: `src/config/config-loader.ts`
- Create: `tests/model.test.ts`
- Create: `tests/config-loader.test.ts`

**Steps:**
1. Define the interfaces and run lifecycle state.
2. Implement defaults matching `.dsh-quality.yaml`.
3. Load project YAML and merge CLI/runtime overrides over file values.
4. Test model construction, defaults, YAML loading, and invalid config errors.

### Task 3: Implement the process executor

**Files:**
- Create: `src/execution/process-executor.ts`
- Create: `src/execution/local-process-executor.ts`
- Create: `tests/process-executor.test.ts`

**Steps:**
1. Define `ProcessExecutor`, `ProcessOptions`, and `ProcessResult`.
2. Implement shell execution with stdout/stderr capture and duration.
3. Implement timeout termination and `timedOut` reporting.
4. Test success, non-zero exit, missing command, and timeout.

### Task 4: Implement project detection and TestChecker

**Files:**
- Create: `src/checkers/checker.ts`
- Create: `src/checkers/test/detector.ts`
- Create: `src/checkers/test/test-command.ts`
- Create: `src/checkers/test/test-checker.ts`
- Create: `tests/test-checker.test.ts`
- Create: `tests/fixtures/projects/...` test fixture files

**Steps:**
1. Detect Maven, Gradle, Python, and Node projects in deterministic order.
2. Resolve the configured test command and timeout.
3. Execute the command through the injected ProcessExecutor.
4. Map exit code 0 to PASS, non-zero to FAIL, timeout/executor exceptions to ERROR.
5. Truncate captured output while retaining beginning and end.
6. Test detection and all result mappings with a fake executor.

### Task 5: Implement Policy and QualityEngine

**Files:**
- Create: `src/policy/quality-policy.ts`
- Create: `src/policy/default-policy.ts`
- Create: `src/engine/quality-engine.ts`
- Create: `tests/policy.test.ts`
- Create: `tests/quality-engine.test.ts`

**Steps:**
1. Implement the default PASS/WARN/FAIL rules.
2. Make QualityEngine own QualityRun transitions and sequential checker execution.
3. Ensure unsupported checkers become SKIPPED and no executed check becomes WARN.
4. Convert engine exceptions into a failed QualityResult without escaping into the Harness process.
5. Test aggregation, ordering, timestamps, and engine failure behavior.

### Task 6: Implement reporters and CLI

**Files:**
- Create: `src/reporters/reporter.ts`
- Create: `src/reporters/console-reporter.ts`
- Create: `src/reporters/markdown-reporter.ts`
- Create: `src/cli.ts`
- Modify: `src/index.ts`
- Create: `tests/reporters.test.ts`
- Create: `tests/cli.test.ts`
- Create: `.dsh-quality.yaml`
- Create: `README.md`

**Steps:**
1. Implement concise console output containing gate status and failures.
2. Implement Markdown output suitable for `quality-report.md`.
3. Wire `dsh-quality run` to load config, run the engine, report, and set exit code.
4. Test report content and CLI argument parsing.

### Task 7: Implement the recursion-safe Harness Hook and demo

**Files:**
- Create: `src/hooks/harness-hook.ts`
- Create: `examples/python-pytest/...`
- Create: `examples/node/...`
- Create: `tests/harness-hook.test.ts`
- Modify: `README.md`

**Steps:**
1. Define a generic post-execute HarnessEvent adapter.
2. Trigger only on successful code changes when no quality run is active.
3. Skip events marked `source: dsh-quality` and concurrent active runs.
4. Return structured Agent feedback and swallow engine failures at the integration boundary.
5. Add PASS/FAIL demo fixtures and run the full verification suite.

### Task 8: Final verification

**Steps:**
1. Run `npm run typecheck`.
2. Run `npm test`.
3. Run the built CLI against the example PASS and FAIL projects.
4. Verify generated Markdown report and clean up only generated demo output.
5. Review git diff against the v0.1 acceptance checklist.
