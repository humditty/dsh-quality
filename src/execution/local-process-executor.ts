import { spawn } from "node:child_process";
import type { ProcessExecutor, ProcessOptions, ProcessResult } from "./process-executor.js";

export class LocalProcessExecutor implements ProcessExecutor {
  execute(command: string, options: ProcessOptions): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const child = spawn(command, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: true,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let settled = false;

      child.stdout.on("data", (chunk: Buffer | string) => { stdout += chunk.toString(); });
      child.stderr.on("data", (chunk: Buffer | string) => { stderr += chunk.toString(); });

      const timer = setTimeout(() => {
        timedOut = true;
        if (child.pid && process.platform !== "win32") {
          try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
        } else {
          child.kill("SIGTERM");
        }
      }, options.timeoutMs);

      const finish = (exitCode: number) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ exitCode, stdout, stderr, durationMs: Date.now() - startedAt, timedOut });
      };

      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => finish(code ?? (timedOut ? 124 : 1)));
    });
  }
}
