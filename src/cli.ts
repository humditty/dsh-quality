#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./config/config-loader.js";
import { TestChecker } from "./checkers/test/test-checker.js";
import { LocalProcessExecutor } from "./execution/local-process-executor.js";
import { QualityEngine } from "./engine/quality-engine.js";
import { DefaultQualityPolicy } from "./policy/default-policy.js";
import { ConsoleReporter } from "./reporters/console-reporter.js";
import { MarkdownReporter } from "./reporters/markdown-reporter.js";

export interface CliOptions {
  projectRoot: string;
  timeout?: number;
  markdownPath?: string;
}

export function parseCliArgs(args: string[], cwd = process.cwd()): CliOptions {
  const options: CliOptions = { projectRoot: cwd };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--root") options.projectRoot = resolve(cwd, args[++i]);
    else if (arg === "--timeout") options.timeout = Number(args[++i]) * 1000;
    else if (arg === "--report-file") options.markdownPath = resolve(options.projectRoot, args[++i]);
    else if (arg === "--help" || arg === "-h") throw new Error("Usage: dsh-quality run [--root path] [--timeout seconds] [--report-file path]");
  }
  return options;
}

export async function runCli(args: string[]): Promise<number> {
  if (args[0] !== "run") throw new Error("Usage: dsh-quality run [--root path] [--timeout seconds] [--report-file path]");
  const options = parseCliArgs(args.slice(1));
  const config = await loadConfig(options.projectRoot, options);
  const engine = new QualityEngine(
    config.checkers.test.enabled ? [new TestChecker(new LocalProcessExecutor(), config)] : [],
    new DefaultQualityPolicy(config),
    config
  );
  const result = await engine.run({ projectRoot: options.projectRoot, changedFiles: [] });
  if (config.report.console) await new ConsoleReporter().report(result);
  if (config.report.markdown) await new MarkdownReporter(resolve(options.projectRoot, config.report.markdownPath)).report(result);
  return result.status === "FAIL" ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
