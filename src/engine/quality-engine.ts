import { randomUUID } from "node:crypto";
import type { QualityConfig } from "../config/config.js";
import type { QualityChecker } from "../checkers/checker.js";
import type { QualityContext } from "../model/quality-context.js";
import type { QualityResult } from "../model/quality-result.js";
import type { QualityRun } from "../model/quality-run.js";
import type { QualityPolicy } from "../policy/quality-policy.js";

export class QualityEngine {
  private active = false;
  private lastRun?: QualityRun;

  constructor(
    private readonly checkers: QualityChecker[],
    private readonly policy: QualityPolicy,
    private readonly _config?: QualityConfig
  ) {}

  isActive(): boolean { return this.active; }
  getLastRun(): QualityRun | undefined { return this.lastRun; }

  async run(context: QualityContext): Promise<QualityResult> {
    if (this.active || context.qualityRunActive) {
      throw new Error("A QualityRun is already active.");
    }
    this.active = true;
    const run: QualityRun = {
      id: randomUUID(),
      startedAt: new Date(),
      status: "PENDING",
      context: { ...context, qualityRunActive: true },
      checks: []
    };
    this.lastRun = run;
    run.status = "RUNNING";
    try {
      for (const checker of this.checkers) {
        if (!checker.supports(run.context)) {
          run.checks.push({ checkerId: checker.id, status: "SKIPPED", summary: `${checker.name} does not support this project.`, durationMs: 0 });
          continue;
        }
        run.checks.push(await checker.check(run.context));
      }
      const decision = this.policy.evaluate(run.checks, run.context);
      const finishedAt = new Date();
      const result: QualityResult = {
        runId: run.id,
        status: decision.status,
        results: run.checks,
        summary: decision.reasons.join(" "),
        startedAt: run.startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - run.startedAt.getTime()
      };
      run.finishedAt = finishedAt;
      run.status = "COMPLETED";
      run.result = result;
      return result;
    } catch (error) {
      const finishedAt = new Date();
      const message = (error as Error).message;
      const result: QualityResult = {
        runId: run.id,
        status: "FAIL",
        results: run.checks,
        summary: `Quality Engine failed: ${message}`,
        startedAt: run.startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - run.startedAt.getTime(),
        error: message
      };
      run.finishedAt = finishedAt;
      run.status = "FAILED";
      run.result = result;
      return result;
    } finally {
      this.active = false;
    }
  }
}
