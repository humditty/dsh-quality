# DSH Quality

## 中文简介

DSH Quality 是一个面向 Coding Agent 的 evidence-driven quality gate。它不在每次编辑后都跑测试，而是在 Agent 准备结束时判断：当前代码是否已有足够、新鲜、可追溯的验证证据。

### 这次从 v0.1 改了什么？

- **触发点后移**：原先 Hook 会在代码工具完成后立即检查；现在工具结果只记录变更，终止事件才评估 Gate。
- **结果变成证据**：测试不再只是一次 `PASS / FAIL` 输出，而是带输入摘要、计划摘要、命令来源与日志摘要的 `QualityEvidence`。
- **重复执行受控**：同一 ChangeSet 的同一验证计划只自动执行一次；未改相关输入时复用既有证据，改动后才自动判为过期。
- **门禁语义更清楚**：Provider 的 `PASS / FAIL / ERROR / SKIPPED`、Evidence 的 `FRESH / STALE`、Gate 的 `ALLOW / WARN / BLOCK` 分层建模。
- **避免无限修复循环**：失败反馈最多自动 steering 两次；相同失败持续存在时停止自动 steering，保留问题给用户或新的修复 turn 处理。

### 现在真的能做什么？

当前实现包含 v0.1 CLI 与 v0.2 Harness Gate 核心：

- 支持 Maven、Gradle、Python/pytest、Node/npm 测试项目
- 统一执行测试命令，支持取消、超时后的进程组终止、非零退出码、命令异常和运行时日志截断
- 将测试结果转换为 `QualityEvidence`；Provider 执行结果、Evidence 新鲜度、Gate 结论彼此独立
- 输出控制台报告和 `quality-report.md`
- `tools/result` / 兼容的 `tools/post-execute` 仅观察变更；`agent/turn-stopping` 才触发 Gate
- Git 工作区中会以 `HEAD` 差异和未跟踪文件补全 ChangeSet；同一 ChangeSet 复用 fresh Evidence，不重复运行相同测试；相关文件再次改变后 Evidence 自动失效
- `advisory`、`gate`、`strict` 三种模式，以及同一失败最多两次自动 steering 的修复上限
- 提供正常项目和故障项目示例，可复现 PASS / FAIL

### 当前边界

当前仍不是完整的企业质量平台：没有真实 DeepSeek Harness 的安装/注册包，也没有 affected-test、Lint、Coverage、安全扫描、Dashboard 或持久化 Evidence。Harness 接入目前通过通用 `HarnessHook` 接收事件对象；宿主需要把实际 Harness 事件映射给该适配器。Git 不可用时会退回 Observer 路径并降为 low confidence；这不是隔离沙箱，项目测试脚本仍在本机执行。

完整设计与当前实现边界见 [v0.2 Evidence-driven Quality Gate 设计](docs/design/2026-08-14-evidence-driven-quality-gate-v0.2.md)。

### 30 秒运行

```bash
npm install --ignore-scripts
npm run build
node dist/src/cli.js run --root examples/node
```

预期结果：`Quality Gate: PASS`。再运行故障示例：

```bash
node dist/src/cli.js run --root examples/node-fail
```

预期结果：`Quality Gate: FAIL`，并以退出码 `1` 结束。这就是当前版本已经验证过的真实运行路径。

---

## English

DSH Quality is an evidence-driven quality gate for coding agents. The CLI retains the v0.1 test-runner flow, while the Harness core records changes, plans verification obligations, reuses fresh evidence, and blocks terminal completion only when required evidence is missing, stale, failed, or unavailable.

## Supported test commands

| Project marker | Command |
| --- | --- |
| `pom.xml` | `mvn test` |
| `build.gradle` / `build.gradle.kts` | `./gradlew test` or `gradle test` |
| `pytest.ini` / `pyproject.toml` / `requirements.txt` | `pytest` |
| `package.json` | `npm test` |

## Run the quality gate

```bash
npm install --ignore-scripts
npm run build
node dist/src/cli.js run --root examples/node
```

The CLI writes `quality-report.md` in the project root and exits with code 1 when the gate is FAIL.

Options:

```text
dsh-quality run [--root path] [--timeout seconds] [--report-file path]
```

`.dsh-quality.yaml` is optional. YAML timeouts are seconds and CLI `--timeout` values are seconds. The v0.2 Gate adds `mode`, `gate.auto_execute_missing_evidence`, and `repair` controls; see the included configuration file for defaults.

## Harness integration

`HarnessHook` accepts generic tool-result and terminal events. Tool events only update the change ledger; the Gate runs at `agent/turn-stopping`. Events emitted by DSH Quality are ignored when they carry `metadata.source: dsh-quality`.

```ts
const coordinator = createDefaultQualityCoordinator(config);
const hook = new HarnessHook(
  coordinator,
  (feedback) => logger.info(feedback),
  (feedback) => host.steerAgent(agent, feedback) // 宿主负责映射为实际 Harness 的 steering 调用
);
await hook.handle({
  type: "tools/result",
  success: true,
  changedFiles: ["src/user.ts"],
  projectRoot: process.cwd(),
  mayHaveMutated: true
});
await hook.handle({ type: "agent/turn-stopping", success: true, changedFiles: [], projectRoot: process.cwd() });
```

## Architecture

```text
ChangeTracker → DeterministicPlanner → Verification Obligations
                                       ↓
TestEvidenceProvider → EvidenceStore → GateEvaluator → RepairController
```

The v0.2 provider, evidence, evaluator, and reporter boundaries allow future Lint, Coverage, Security, JSON, or dashboard support without changing Gate lifecycle semantics.

## Verification

```bash
npm run typecheck
npm test
node dist/src/cli.js run --root examples/node
```

The included `examples/node` project demonstrates PASS; `examples/node-fail` is an intentional FAIL fixture for the feedback path:

```bash
node dist/src/cli.js run --root examples/node-fail
```
