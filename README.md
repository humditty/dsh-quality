# DSH Quality

## 中文简介

DSH Quality 是一个可独立运行的 Agent 代码质量门禁插件。它会在代码发生变更后自动识别项目类型、执行测试、收集标准输出和错误信息，再根据 Quality Policy 给出 `PASS`、`WARN` 或 `FAIL`，并生成可反馈给 Agent 的结构化结果。

### 现在真的能做什么？

当前 v0.1 已经可以直接运行，并覆盖最小闭环：

- 支持 Maven、Gradle、Python/pytest、Node/npm 测试项目
- 统一执行测试命令，支持超时、非零退出码、命令异常和日志截断
- 测试通过返回 `PASS`，测试失败或执行错误返回 `FAIL`
- 输出控制台报告和 `quality-report.md`
- 通过通用 `tools/post-execute` Hook 感知代码变更，并避免质量检查递归触发
- 提供正常项目和故障项目示例，可复现 PASS / FAIL

### 当前边界

这是一个可用的 v0.1 MVP，不是完整的企业质量平台。当前还没有实现真实 Harness 产品的专用事件注册、Lint、覆盖率、安全扫描、Dashboard 或自动修复。Harness 接入目前通过 `HarnessHook` 接收统一事件对象；只要宿主能把工具执行事件转换成这个对象，就可以接入。

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

DSH Quality is a small, standalone quality gate for coding agents. v0.1 detects a project type, runs its tests, turns the process result into a structured `CheckResult`, applies a PASS/WARN/FAIL policy, and reports concise feedback.

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

`.dsh-quality.yaml` is optional. Project configuration uses the documented v0.1 shape; timeout values in YAML are seconds and CLI `--timeout` values are seconds.

## Harness integration

`HarnessHook` accepts a generic `tools/post-execute` event. It triggers only when the tool succeeded, changed a code file, and no quality run is active. Events emitted by DSH Quality are ignored when they carry `metadata.source: dsh-quality`, which prevents recursive quality runs.

```ts
const hook = new HarnessHook(engine, (feedback) => agent.send(feedback));
await hook.handle({
  type: "tools/post-execute",
  success: true,
  changedFiles: ["src/user.ts"],
  projectRoot: process.cwd()
});
```

## Architecture

```text
HarnessHook → QualityEngine → QualityChecker → ProcessExecutor
                         ↓
                   QualityPolicy
                         ↓
                    Reporters
```

The TestChecker, ProcessExecutor, Policy, and Reporter are interfaces at their boundaries so later Lint, Coverage, Security, JSON, or dashboard integrations can be added without changing the Engine lifecycle.

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
