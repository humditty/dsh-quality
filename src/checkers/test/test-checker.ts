import type { QualityConfig } from "../../config/config.js";
import type { ProcessExecutor } from "../../execution/process-executor.js";
import type { CheckResult } from "../../model/check-result.js";
import type { QualityContext } from "../../model/quality-context.js";
import type { QualityChecker } from "../checker.js";
import { detectProjectType } from "./detector.js";
import { resolveTestCommand } from "./test-command.js";

export function truncateOutput(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  const marker = "\n...[output truncated]...\n";
  if (maxChars <= marker.length) return value.slice(0, maxChars);
  const available = Math.max(0, maxChars - marker.length);
  const head = Math.ceil(available / 2);
  const tail = Math.floor(available / 2);
  return value.slice(0, head) + marker + value.slice(-tail);
}

export class TestChecker implements QualityChecker {
  readonly id = "test";
  readonly name = "Test Checker";

  constructor(private readonly executor: ProcessExecutor, private readonly config: QualityConfig) {}

  supports(context: QualityContext): boolean {
    return detectProjectType(context.projectRoot) !== undefined;
  }

  async check(context: QualityContext): Promise<CheckResult> {
    const startedAt = Date.now();
    const projectType = detectProjectType(context.projectRoot);
    if (!projectType) {
      return { checkerId: this.id, status: "SKIPPED", summary: "No supported project type detected.", durationMs: 0 };
    }

    const command = resolveTestCommand(context.projectRoot, projectType);
    try {
      const processResult = await this.executor.execute(command, {
        cwd: context.projectRoot,
        timeoutMs: this.config.checkers.test.timeout
      });
      const details = {
        projectType,
        command,
        exitCode: processResult.exitCode,
        timedOut: processResult.timedOut,
        stdout: truncateOutput(processResult.stdout, this.config.output.maxStdoutChars),
        stderr: truncateOutput(processResult.stderr, this.config.output.maxStderrChars)
      };
      if (processResult.timedOut) {
        return { checkerId: this.id, status: "ERROR", summary: "Test execution timed out.", durationMs: processResult.durationMs, details };
      }
      if (processResult.exitCode === 0) {
        return { checkerId: this.id, status: "PASS", summary: `${projectType} tests passed.`, durationMs: processResult.durationMs, details };
      }
      return {
        checkerId: this.id,
        status: "FAIL",
        summary: `${projectType} tests failed (exit code ${processResult.exitCode}).`,
        durationMs: processResult.durationMs,
        details
      };
    } catch (error) {
      return {
        checkerId: this.id,
        status: "ERROR",
        summary: `Unable to execute ${command}: ${(error as Error).message}`,
        durationMs: Date.now() - startedAt,
        details: { projectType, command }
      };
    }
  }
}
