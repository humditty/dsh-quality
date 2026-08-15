export interface QualityConfig {
  version: number;
  mode: "advisory" | "gate" | "strict";
  trigger: {
    onCodeChange: boolean;
  };
  checkers: {
    test: {
      enabled: boolean;
      timeout: number;
    };
  };
  policy: {
    failOnTestFailure: boolean;
    failOnCheckerError: boolean;
  };
  gate: {
    autoExecuteMissingEvidence: boolean;
  };
  repair: {
    enabled: boolean;
    maxSteersPerChangeSet: number;
    stopAfterSameFailure: number;
  };
  report: {
    console: boolean;
    markdown: boolean;
    markdownPath: string;
  };
  output: {
    maxStdoutChars: number;
    maxStderrChars: number;
  };
}

export const DEFAULT_CONFIG: QualityConfig = {
  version: 1,
  mode: "gate",
  trigger: { onCodeChange: true },
  checkers: { test: { enabled: true, timeout: 120_000 } },
  policy: { failOnTestFailure: true, failOnCheckerError: true },
  gate: { autoExecuteMissingEvidence: true },
  repair: { enabled: true, maxSteersPerChangeSet: 2, stopAfterSameFailure: 2 },
  report: { console: true, markdown: true, markdownPath: "quality-report.md" },
  output: { maxStdoutChars: 10_000, maxStderrChars: 10_000 }
};
