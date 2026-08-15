import { randomUUID } from "node:crypto";
import type { CheckResult } from "../model/check-result.js";
import type { QualityContext } from "../model/quality-context.js";
import type { QualityEvidence, ProviderOutcome } from "../model/quality-evidence.js";
import type { QualityPlan, VerificationObligation } from "../model/quality-plan.js";
import type { EvidenceProvider } from "./evidence-provider.js";

interface TestCheckerLike {
  id: string;
  check(context: QualityContext): Promise<CheckResult>;
}

interface TestDetails {
  command?: string;
  exitCode?: number;
  timedOut?: boolean;
}

function toOutcome(status: CheckResult["status"]): ProviderOutcome {
  if (status === "PASS") return "PASS";
  if (status === "FAIL") return "FAIL";
  if (status === "SKIPPED") return "SKIPPED";
  return "ERROR";
}

export class TestEvidenceProvider implements EvidenceProvider {
  readonly id = "test";
  readonly kind = "test" as const;

  constructor(private readonly checker: TestCheckerLike) {}

  supports(obligation: VerificationObligation, _context: QualityContext): boolean {
    return obligation.kind === this.kind;
  }

  async collect(obligation: VerificationObligation, plan: QualityPlan, context: QualityContext): Promise<QualityEvidence> {
    const result = await this.checker.check(context);
    const details = (result.details ?? {}) as TestDetails;
    return {
      id: randomUUID(),
      obligationId: obligation.id,
      kind: "test",
      producer: { id: this.checker.id },
      outcome: toOutcome(result.status),
      scope: obligation.scope,
      inputDigest: obligation.inputDigest,
      planDigest: plan.digest,
      observedAt: new Date(),
      durationMs: result.durationMs,
      provenance: {
        commandId: details.command ?? this.checker.id,
        cwd: context.projectRoot,
        exitCode: details.exitCode,
        timedOut: details.timedOut ?? false
      },
      summary: result.summary,
      issues: result.issues ?? []
    };
  }
}
