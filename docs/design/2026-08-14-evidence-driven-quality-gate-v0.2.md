# DSH Quality v0.2：可实践实施方案

> 状态：已实现。此文档是 v0.2 的唯一范围定义；不在本版本提前引入风险规划、affected tests、Lint、Coverage 或 Dashboard。

## 目标

v0.1 证明了失败后可以让 Agent 再修一次。v0.2 只证明两件更基础的事：

1. DSH Quality 知道一次验证对应哪一版代码。
2. DSH Quality 知道什么时候必须停止自动修复。

本版本只解决四个能力：

```text
Workspace Fingerprint
→ Evidence Freshness
→ Failure Fingerprint
→ Repair Loop Guard
```

`VerificationEvidence` 是承载这些能力的数据记录，不是额外的质量工具。验证仍然只运行现有的测试命令。

## 核心流程

```text
Agent 尝试结束
       ↓
获取当前 Workspace Fingerprint
       ↓
存在同一 fingerprint 的 PASS Evidence？
       ├── 是：ALLOW
       └── 否：运行验证
                  ↓
            验证前后 fingerprint 相同？
              ├── 否：自动重验一次
              └── 是：保存 Evidence
                         ↓
                    PASS → ALLOW
                    FAIL / ERROR → Failure Fingerprint → Repair Loop Guard
```

重复失败达到阈值时，系统发送最后一条明确要求“不要宣称成功、请总结未解决问题”的 steering，并进入 terminal failure mode。下一次 `agent/turn-stopping` 返回 `ALLOW`，让 Agent 能如实结束而不是无限循环。

## 1. Workspace Fingerprint

只支持 Git 工作区，接口如下：

```ts
interface WorkspaceFingerprinter {
  fingerprint(workspace: string): Promise<string>;
}
```

`GitWorkspaceFingerprinter` 对以下状态做 SHA-256：

```text
HEAD
+ git status --porcelain
+ 排序后的变更文件路径
+ 每个变更文件的内容哈希（已删除文件使用 DELETED）
```

因此它描述的是当前工作区状态，而不是“发生过多少次修改”。恢复原内容会恢复原 fingerprint。非 Git 工作区不能得到 v0.2 指纹，Gate 会产生 ERROR 并阻断，而不会假装验证有效。

## 2. Verification Evidence 与 Freshness

```ts
interface VerificationEvidence {
  id: string;
  type: "COMMAND";
  producer: string;
  workspaceFingerprint: string;
  command: string;
  status: "PASS" | "FAIL" | "ERROR";
  exitCode?: number;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  stdout?: string;
  stderr?: string;
  failureFingerprint?: string;
}
```

Fresh 的定义刻意严格：

```ts
evidence.status === "PASS"
&& evidence.workspaceFingerprint === currentFingerprint
```

只有满足这个条件才跳过命令执行。FAIL 和 ERROR 不会被当作“已完成验证”，所以 Agent 继续尝试结束时会再次验证，并由修复保护决定何时停止自动反馈。

验证命令有副作用时，Gate 比较 before/after fingerprint。不同则最多自动重验一次；仍不同则以 ERROR 阻断，避免无限执行。

## 3. Failure Fingerprint 与 Repair Loop Guard

失败指纹由以下内容计算：

```text
exit code
+ normalized stderr tail
+ normalized stdout tail
```

标准化会移除 ANSI 颜色、时间、UUID、临时目录并压缩空白。这样 `FAIL A → FAIL B` 被视为仍有进展，而 `FAIL A → FAIL A` 会累计同一失败次数。

状态模型：

```ts
interface QualityState {
  lastEvidence?: VerificationEvidence;
  repairAttempts: number;
  sameFailureCount: number;
  lastFailureFingerprint?: string;
  terminalFailureMode: boolean;
}
```

默认配置：

```yaml
repair:
  enabled: true
  max_attempts: 4
  max_same_failure: 2

feedback:
  stdout_tail: 3000
  stderr_tail: 5000
  max_chars: 8000
```

达到任一阈值时停止自动修复。反馈包含命令、退出码、workspace、修复次数、同一失败次数和截断后的相关输出；第一版不解析测试框架的断言细节。

## 4. 组成与接入

```text
src/
├── workspace/     GitWorkspaceFingerprinter
├── evidence/      VerificationEvidence、freshness、failure fingerprint
├── verification/  TestCommandVerifier
├── repair/        QualityState、RepairLoopController
├── feedback/      FeedbackComposer
└── gate/          QualityGate
```

默认组合入口是 `createDefaultQualityGate(config)`。`HarnessHook` 将终止事件交给该 Gate，并将 `BLOCK` 结果的结构化反馈交给宿主的 steering 机制。旧协调器只保留为兼容 API，不是 v0.2 默认路径。

## 验收清单

- [x] Fingerprint 在工作区不变时稳定。
- [x] 修改、增加、删除文件会改变 Fingerprint。
- [x] 恢复原文件内容会恢复原 Fingerprint。
- [x] PASS Evidence 仅在 fingerprint 一致时复用。
- [x] 工作区变化后旧 PASS 必须重新验证。
- [x] 验证过程改变工作区时自动重验一次。
- [x] 修复成功后重置修复状态。
- [x] 不同失败保留修复机会；重复失败停止自动修复。
- [x] 终止修复后下一次结束允许 Agent 如实报告失败。
- [x] 反馈结构化且限制长度。

## v0.2 之后：先做数据，不做 v0.3

v0.2 完成后，先准备 20 个 Coding Tasks：5 个简单修改、5 个 Bug Fix、5 个边界条件、5 个多轮修复。对 DSH Harness 与 DSH Harness + DSH Quality 分别执行，记录：任务数、Block 次数、发现错误数、自动修复成功数、平均 Repair 次数、重复失败数、最终未解决数和平均验证时间。

记录格式从最小 CSV 开始：

```csv
task,blocked,repair_attempts,final_pass,duration
01,true,1,true,12.3
02,false,0,true,8.1
03,true,3,false,28.7
```

只有数据再决定 v0.3：慢则做 Verification Plan / affected tests；反馈差则做 Structured Failure Parser；测试覆盖不足则做 Build + Lint Evidence；风险差异明显才做 ChangeSet + Risk Planner。
