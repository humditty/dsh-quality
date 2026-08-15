import { randomUUID } from "node:crypto";
import type { CheckResult } from "../model/check-result.js";
import type { QualityContext } from "../model/quality-context.js";
import { createFailureFingerprint } from "../evidence/failure-fingerprint.js";
import type { VerificationEvidence, VerificationStatus } from "../evidence/verification-evidence.js";

export interface CommandVerifier {
  verify(context: QualityContext, workspaceFingerprint: string): Promise<VerificationEvidence>;
}

interface TestCheckerLike {
  id: string;
  check(context: QualityContext): Promise<CheckResult>;
}

interface CommandDetails {
  command?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

export class TestCommandVerifier implements CommandVerifier {
  constructor(private readonly checker: TestCheckerLike) {}

  async verify(context: QualityContext, workspaceFingerprint: string): Promise<VerificationEvidence> {
    const startedAt = Date.now();
    const result = await this.checker.check(context);
    const finishedAt = Date.now();
    const details = (result.details ?? {}) as CommandDetails;
    const evidence: VerificationEvidence = {
      id: randomUUID(),
      type: "COMMAND",
      producer: this.checker.id,
      workspaceFingerprint,
      command: details.command ?? this.checker.id,
      status: toStatus(result.status),
      exitCode: details.exitCode,
      startedAt,
      finishedAt,
      durationMs: result.durationMs,
      stdout: details.stdout,
      stderr: details.stderr
    };
    return { ...evidence, failureFingerprint: createFailureFingerprint(evidence) };
  }
}

function toStatus(status: CheckResult["status"]): VerificationStatus {
  if (status === "PASS") return "PASS";
  if (status === "FAIL") return "FAIL";
  return "ERROR";
}
