export interface ProcessOptions {
  cwd: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
}

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

export interface ProcessExecutor {
  execute(command: string, options: ProcessOptions): Promise<ProcessResult>;
}
