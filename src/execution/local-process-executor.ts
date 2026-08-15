import { spawn } from "node:child_process";
import type { ProcessExecutor, ProcessOptions, ProcessResult } from "./process-executor.js";

const DEFAULT_MAX_OUTPUT_CHARS = 1_000_000;
const DEFAULT_KILL_GRACE_MS = 1_000;
const TRUNCATION_MARKER = "\n...[output truncated during execution]...\n";

class BoundedOutput {
  private value = "";
  private truncated = false;

  constructor(private readonly limit: number) {}

  append(chunk: Buffer | string): void {
    if (this.truncated) return;
    const text = chunk.toString();
    const available = Math.max(0, this.limit - TRUNCATION_MARKER.length - this.value.length);
    if (text.length <= available) {
      this.value += text;
      return;
    }
    this.value += text.slice(0, available);
    this.truncated = true;
  }

  toString(): string {
    if (!this.truncated) return this.value;
    if (this.limit <= TRUNCATION_MARKER.length) return TRUNCATION_MARKER.slice(0, this.limit);
    return this.value + TRUNCATION_MARKER;
  }
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

export class LocalProcessExecutor implements ProcessExecutor {
  execute(command: string, options: ProcessOptions): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      if (options.signal?.aborted) {
        resolve({ exitCode: 130, stdout: "", stderr: "", durationMs: 0, timedOut: false, aborted: true });
        return;
      }
      const child = spawn(command, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: true,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"]
      });
      const stdout = new BoundedOutput(positiveInteger(options.maxStdoutChars, DEFAULT_MAX_OUTPUT_CHARS));
      const stderr = new BoundedOutput(positiveInteger(options.maxStderrChars, DEFAULT_MAX_OUTPUT_CHARS));
      let timedOut = false;
      let aborted = false;
      let settled = false;
      let terminationRequested = false;
      let forceKillTimer: NodeJS.Timeout | undefined;
      const killGraceMs = positiveInteger(options.killGraceMs, DEFAULT_KILL_GRACE_MS);

      child.stdout.on("data", (chunk: Buffer | string) => { stdout.append(chunk); });
      child.stderr.on("data", (chunk: Buffer | string) => { stderr.append(chunk); });

      const terminate = (signal: NodeJS.Signals) => {
        if (child.pid && process.platform !== "win32") {
          try { process.kill(-child.pid, signal); return; } catch { /* Fall through to the shell process. */ }
        }
        child.kill(signal);
      };

      const requestTermination = (reason: "timeout" | "abort") => {
        if (terminationRequested || settled) return;
        terminationRequested = true;
        timedOut ||= reason === "timeout";
        aborted ||= reason === "abort";
        terminate("SIGTERM");
        forceKillTimer = setTimeout(() => {
          if (!settled) terminate("SIGKILL");
        }, killGraceMs);
      };

      const timer = setTimeout(() => {
        requestTermination("timeout");
      }, options.timeoutMs);
      const onAbort = () => requestTermination("abort");
      options.signal?.addEventListener("abort", onAbort, { once: true });

      const finish = (exitCode: number) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (forceKillTimer) clearTimeout(forceKillTimer);
        options.signal?.removeEventListener("abort", onAbort);
        resolve({ exitCode, stdout: stdout.toString(), stderr: stderr.toString(), durationMs: Date.now() - startedAt, timedOut, aborted });
      };

      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (forceKillTimer) clearTimeout(forceKillTimer);
        options.signal?.removeEventListener("abort", onAbort);
        reject(error);
      });
      child.on("close", (code) => finish(code ?? (timedOut ? 124 : 1)));
    });
  }
}
