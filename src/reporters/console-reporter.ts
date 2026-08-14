import type { QualityResult } from "../model/quality-result.js";
import type { QualityReporter } from "./reporter.js";

export class ConsoleReporter implements QualityReporter {
  constructor(private readonly output: (message: string) => void = console.log) {}

  async report(result: QualityResult): Promise<void> {
    const lines = ["DSH Quality", "", ...result.results.map((check) => {
      const icon = check.status === "PASS" ? "✓" : check.status === "SKIPPED" ? "-" : "✗";
      return `${icon} ${check.summary} [${check.status}]`;
    }), "", `Quality Gate: ${result.status}`, `Duration: ${(result.durationMs / 1000).toFixed(2)}s`];
    if (result.error) lines.push(`Error: ${result.error}`);
    this.output(lines.join("\n"));
  }
}
