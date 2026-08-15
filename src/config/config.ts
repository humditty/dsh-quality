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
    maxAttempts: number;
    maxSameFailure: number;
  };
  feedback: {
    stdoutTail: number;
    stderrTail: number;
    maxChars: number;
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
  version: 2,
  mode: "gate",
  trigger: { onCodeChange: true },
  checkers: { test: { enabled: true, timeout: 120_000 } },
  policy: { failOnTestFailure: true, failOnCheckerError: true },
  gate: { autoExecuteMissingEvidence: true },
  repair: { enabled: true, maxAttempts: 4, maxSameFailure: 2 },
  feedback: { stdoutTail: 3_000, stderrTail: 5_000, maxChars: 8_000 },
  report: { console: true, markdown: true, markdownPath: "quality-report.md" },
  output: { maxStdoutChars: 10_000, maxStderrChars: 10_000 }
};
