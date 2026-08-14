export interface QualityConfig {
  version: number;
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
  trigger: { onCodeChange: true },
  checkers: { test: { enabled: true, timeout: 120_000 } },
  policy: { failOnTestFailure: true, failOnCheckerError: true },
  report: { console: true, markdown: true, markdownPath: "quality-report.md" },
  output: { maxStdoutChars: 10_000, maxStderrChars: 10_000 }
};
