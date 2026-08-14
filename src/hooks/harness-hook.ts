import type { QualityContext } from "../model/quality-context.js";
import type { QualityResult } from "../model/quality-result.js";
import { QualityEngine } from "../engine/quality-engine.js";

export interface HarnessEvent {
  type: string;
  success: boolean;
  changedFiles: string[];
  projectRoot: string;
  metadata?: Record<string, unknown>;
}

export class HarnessHook {
  constructor(private readonly engine: QualityEngine, private readonly onFeedback?: (message: string) => void) {}

  async handle(event: HarnessEvent): Promise<QualityResult | undefined> {
    if (event.type !== "tools/post-execute" || !event.success || event.changedFiles.length === 0) return undefined;
    if (event.metadata?.source === "dsh-quality" || event.metadata?.qualityRunActive === true || this.engine.isActive()) return undefined;
    if (!event.changedFiles.some(isCodeFile)) return undefined;

    const context: QualityContext = {
      projectRoot: event.projectRoot,
      changedFiles: event.changedFiles,
      metadata: event.metadata,
      qualityRunActive: false
    };
    const result = await this.engine.run(context);
    this.onFeedback?.(formatAgentFeedback(result));
    return result;
  }
}

function isCodeFile(file: string): boolean {
  return /\.(java|kt|kts|py|js|jsx|ts|tsx|mjs|cjs|go|rs|rb|php|cs|cpp|c|h|swift|vue|svelte)$/i.test(file);
}

export function formatAgentFeedback(result: QualityResult): string {
  const lines = [`Quality Gate ${result.status}.`];
  for (const check of result.results) {
    lines.push(`- ${check.checkerId}: ${check.status} — ${check.summary}`);
    const details = check.details as { stderr?: string; stdout?: string } | undefined;
    if (check.status === "FAIL" || check.status === "ERROR") {
      if (details?.stderr) lines.push(`  stderr: ${details.stderr}`);
      if (details?.stdout) lines.push(`  stdout: ${details.stdout}`);
    }
  }
  if (result.status === "FAIL") lines.push("Please inspect the failure and fix the implementation, then run quality verification again.");
  return lines.join("\n");
}
