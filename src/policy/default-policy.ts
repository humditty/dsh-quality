import type { CheckResult } from "../model/check-result.js";
import type { QualityContext } from "../model/quality-context.js";
import { DEFAULT_CONFIG, type QualityConfig } from "../config/config.js";
import type { QualityPolicy, QualityDecision } from "./quality-policy.js";

export class DefaultQualityPolicy implements QualityPolicy {
  constructor(private readonly config: Pick<QualityConfig, "policy"> = DEFAULT_CONFIG) {}

  evaluate(results: CheckResult[], _context: QualityContext): QualityDecision {
    const reasons: string[] = [];
    let fatal = false;
    let downgraded = false;
    for (const result of results) {
      if (result.status === "ERROR") {
        reasons.push(`${result.checkerId}: ${result.summary}`);
        if (this.config.policy.failOnCheckerError) fatal = true;
        else downgraded = true;
      }
      if (result.status === "FAIL") {
        reasons.push(`${result.checkerId}: ${result.summary}`);
        if (result.checkerId !== "test" || this.config.policy.failOnTestFailure) fatal = true;
        else downgraded = true;
      }
      if (result.status === "WARN") reasons.push(`${result.checkerId}: ${result.summary}`);
    }
    if (fatal) {
      return { status: "FAIL", reasons };
    }
    if (results.length === 0 || results.every((result) => result.status === "SKIPPED")) {
      return { status: "WARN", reasons: ["No quality checker was executed."] };
    }
    if (downgraded || results.some((result) => result.status === "WARN")) return { status: "WARN", reasons };
    return { status: "PASS", reasons: ["All executed quality checks passed."] };
  }
}
