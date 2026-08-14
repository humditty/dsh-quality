import { writeFile } from "node:fs/promises";
import type { QualityResult } from "../model/quality-result.js";
import type { QualityReporter } from "./reporter.js";

function escapeMarkdown(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", "  \n");
}

export class MarkdownReporter implements QualityReporter {
  constructor(private readonly filePath: string) {}

  async report(result: QualityResult): Promise<void> {
    const lines = [
      "# DSH Quality Report",
      "",
      `- **Quality Gate:** ${result.status}`,
      `- **Run ID:** \`${result.runId}\``,
      `- **Duration:** ${(result.durationMs / 1000).toFixed(2)}s`,
      "",
      "## Checks",
      "",
      "| Checker | Status | Summary | Duration |",
      "| --- | --- | --- | ---: |",
      ...result.results.map((check) => `| ${escapeMarkdown(check.checkerId)} | ${check.status} | ${escapeMarkdown(check.summary)} | ${(check.durationMs / 1000).toFixed(2)}s |`)
    ];
    if (result.error) lines.push("", `**Engine error:** ${escapeMarkdown(result.error)}`);
    await writeFile(this.filePath, lines.join("\n") + "\n", "utf8");
  }
}
