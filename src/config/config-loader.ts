import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { DEFAULT_CONFIG, type QualityConfig } from "./config.js";

type PartialConfig = {
  version?: number;
  trigger?: { on_code_change?: boolean; onCodeChange?: boolean };
  checkers?: { test?: { enabled?: boolean; timeout?: number } };
  policy?: { fail_on_test_failure?: boolean; failOnTestFailure?: boolean; fail_on_checker_error?: boolean; failOnCheckerError?: boolean };
  report?: { console?: boolean; markdown?: boolean; markdown_path?: string; markdownPath?: string };
  output?: { max_stdout_chars?: number; maxStdoutChars?: number; max_stderr_chars?: number; maxStderrChars?: number };
};

export interface ConfigOverrides {
  timeout?: number;
  markdownPath?: string;
}

function mergeConfig(base: QualityConfig, raw: PartialConfig, overrides: ConfigOverrides): QualityConfig {
  return {
    version: raw.version ?? base.version,
    trigger: {
      onCodeChange: raw.trigger?.onCodeChange ?? raw.trigger?.on_code_change ?? base.trigger.onCodeChange
    },
    checkers: {
      test: {
        enabled: raw.checkers?.test?.enabled ?? base.checkers.test.enabled,
        timeout: overrides.timeout ?? (raw.checkers?.test?.timeout !== undefined
          ? raw.checkers.test.timeout * 1000
          : base.checkers.test.timeout)
      }
    },
    policy: {
      failOnTestFailure: raw.policy?.failOnTestFailure ?? raw.policy?.fail_on_test_failure ?? base.policy.failOnTestFailure,
      failOnCheckerError: raw.policy?.failOnCheckerError ?? raw.policy?.fail_on_checker_error ?? base.policy.failOnCheckerError
    },
    report: {
      console: raw.report?.console ?? base.report.console,
      markdown: raw.report?.markdown ?? base.report.markdown,
      markdownPath: overrides.markdownPath ?? raw.report?.markdownPath ?? raw.report?.markdown_path ?? base.report.markdownPath
    },
    output: {
      maxStdoutChars: raw.output?.maxStdoutChars ?? raw.output?.max_stdout_chars ?? base.output.maxStdoutChars,
      maxStderrChars: raw.output?.maxStderrChars ?? raw.output?.max_stderr_chars ?? base.output.maxStderrChars
    }
  };
}

export async function loadConfig(projectRoot: string, overrides: ConfigOverrides = {}): Promise<QualityConfig> {
  const configPath = join(projectRoot, ".dsh-quality.yaml");
  let raw: PartialConfig = {};
  try {
    raw = (parse(await readFile(configPath, "utf8")) ?? {}) as PartialConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error(`Unable to read ${configPath}: ${(error as Error).message}`);
    }
  }
  return mergeConfig(DEFAULT_CONFIG, raw, overrides);
}
