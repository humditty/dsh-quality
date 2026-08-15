# DSH Quality v0.2 Benchmark

v0.2 完成后不直接进入 v0.3。先用同一组 20 个 Coding Tasks 对比：

```text
DSH Harness
DSH Harness + DSH Quality
```

**状态：任务与结果模板已准备，实际对照运行待真实 DSH Harness 安装/注册适配器可用后执行。** 不要用单元测试或模拟 Hook 冒充这两组 Agent 实验结果。

每个任务在两个变体中使用相同起始提交、相同任务提示、相同模型和相同预算。完成一次运行后，在对应 CSV 增加一行：

```csv
task,blocked,repair_attempts,final_pass,duration
01,true,1,true,12.3
```

`duration` 表示验证耗时（秒）。从两份 CSV 计算：

- 任务数；
- Quality Block 次数（`blocked=true`）；
- 成功发现错误次数（被 Block 且随后 `final_pass=true`）；
- 自动修复成功次数（`repair_attempts>0 && final_pass=true`）；
- 平均 Repair 次数；
- 重复失败次数（从运行日志中标记为同一 Failure Fingerprint 达阈值）；
- 最终未解决次数（`final_pass=false`）；
- 平均 Verification 时间。

不要根据单次任务决定 v0.3。20 个任务全部跑完后再判断：验证慢才考虑 affected tests；反馈差才考虑 Failure Parser；测试漏检多才考虑 Build/Lint；风险差异显著才考虑风险规划。
