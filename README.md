# DSH Quality

> **让 Coding Agent 在宣布完成之前，用可验证证据证明自己的工作。**

> **Make coding agents prove their work before they declare it done.**

## 为什么存在？

Coding Agent 会理解任务、修改代码，然后说“完成了”。但“完成”首先只是模型对上下文的判断，不等于工程上的真实状态。

```text
Agent 的完成声明
≠
代码已经满足任务结束条件
```

真实世界仍需要回答：代码能否构建？测试是否通过？改动是否引入回归？当前代码是否仍对应那次验证？

DSH Quality 处理的正是这段差距：把 Agent 的主观完成声明，变成基于当前代码状态的可验证结论。

## 什么算完成？

DSH Quality 不试图定义“什么是优秀代码”。它只判断：**当前项目声明的结束条件，是否已经由足够的验证事实满足。**

```text
Agent 声明完成
        ↓
当前改动需要哪些证明？
        ↓
执行真实验证，得到可追溯结果
        ↓
这些结果对当前代码是否仍有效？
        ↓
满足条件 → 允许完成
不满足   → 给出修复反馈，继续工作
```

一项可信证明至少要具备：

- **相关**：与当前改动及其风险有关。
- **真实执行**：来自实际命令、工具或受信任的外部验证，而非模型猜测。
- **新鲜**：验证后相关代码没有再变化。
- **可追溯**：能知道验证了什么、针对哪个代码状态、由谁执行、结果如何。

因此，“之前跑过测试”不够；它必须能证明**现在这份代码**满足所需条件。

## 这是一个反馈闭环

```text
用户要求 → 期望状态
               ↓
Agent → 代码改动 → 所需证明 → 验证结果 → 完成判断
                                             │
                              不足 ← 修复反馈 ←┘
```

当验证不足或失败时，DSH Quality 不只报告问题，还将可操作的反馈交给 Agent。Agent 修复后重新验证；重复失败则会停止自动循环，避免无止境消耗。

这就是项目的产品边界：增强 Agent “完成声明”的可信度。它不是代码生成器、CI/CD 平台、通用日志系统、Agent Benchmark 或聊天界面。

## 当前实现

当前仓库实现了这条闭环的可实践 v0.2，并保留 v0.1 CLI 作为兼容入口。此版本只解决四个能力：

- **Workspace Fingerprint**：只支持 Git 工作区；指纹由 `HEAD`、工作树状态、变更文件和内容哈希组成。
- **Evidence Freshness**：一次命令验证会记录命令、结果、输出、耗时与执行时的 workspace fingerprint；仅当 PASS 证据与当前 fingerprint 相同才复用。
- **Failure Fingerprint**：失败输出会去除时间、UUID、临时目录与 ANSI 噪声后再比较。
- **Repair Loop Guard**：最多 4 次修复、同一失败最多 2 次；停止时发送最后一条“如实报告未解决问题”的反馈，下一次结束允许 Agent 正常退出。

验证前后 fingerprint 不同会自动重验一次，避免把“验证本身改动了工作区”的结果误当作当前结论。命令运行同时支持取消、超时后的进程组终止和运行时日志截断。

当前尚未提供真实 DeepSeek Harness 的安装/注册包，也没有 affected-test、Lint、Coverage、安全扫描、持久化结果或 Dashboard。它也不是隔离沙箱：项目测试脚本仍在本机执行。

完整的架构、边界和路线图见 [v0.2 Evidence-driven Quality Gate 设计](docs/design/2026-08-14-evidence-driven-quality-gate-v0.2.md)。

## 30 秒运行

```bash
npm install --ignore-scripts
npm run build
node dist/src/cli.js run --root examples/node
```

预期结果：`Quality Gate: PASS`。故障示例会以退出码 `1` 结束：

```bash
node dist/src/cli.js run --root examples/node-fail
```

## English

DSH Quality turns an agent’s subjective “done” into a verifiable completion decision. It asks one question: **does the current code have enough trustworthy proof to satisfy this project’s declared completion criteria?**

```text
Claim completion → determine required proof → run verification
→ bind results to the current code state → allow completion or request repair
```

Proof must be relevant to the change, produced by real execution, fresh for the current code state, and traceable to its source and result. DSH Quality is a feedback loop for coding agents—not a code generator, CI/CD platform, generic log system, agent benchmark, or chat UI.

### Current capabilities

- Git-only workspace fingerprints built from `HEAD`, status, changed paths, and file contents.
- Reuse only a passing command verification whose fingerprint matches the current workspace.
- Maven, Gradle, pytest, and npm test execution.
- Normalized failure fingerprints plus bounded repair attempts and repeated-failure detection.
- One automatic re-verification when verification changes the workspace.
- Cancellation, timeout escalation, and bounded command output.

The repository currently exposes a v0.1-compatible CLI and v0.2 core library. A production DeepSeek Harness adapter, affected-test analysis, lint, coverage, security, durable storage, and a dashboard are future work.

## Run

```bash
npm install --ignore-scripts
npm run build
node dist/src/cli.js run --root examples/node
```

The CLI writes `quality-report.md` and exits with code 1 when the gate fails.

```text
dsh-quality run [--root path] [--timeout seconds] [--report-file path]
```

## Library integration

`HarnessHook` accepts generic tool-result and terminal events. Map your host events to it, then connect its steering callback to the host’s actual continuation mechanism.

```ts
const qualityGate = createDefaultQualityGate(config);
const hook = new HarnessHook(
  qualityGate,
  (feedback) => logger.info(feedback),
  (feedback) => host.steerAgent(agent, feedback)
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

## Verification

```bash
npm run typecheck
npm test
node dist/src/cli.js run --root examples/node
```
