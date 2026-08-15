export interface ProcessOptions {
  cwd: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  maxStdoutChars?: number;
  maxStderrChars?: number;
  killGraceMs?: number;
}

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  aborted: boolean;
}

export interface ProcessExecutor {
  execute(command: string, options: ProcessOptions): Promise<ProcessResult>;
}
