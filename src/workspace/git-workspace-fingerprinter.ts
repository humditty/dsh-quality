import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { promisify } from "node:util";
import type { WorkspaceFingerprinter } from "./workspace-fingerprinter.js";

const execFileAsync = promisify(execFile);

export class GitWorkspaceFingerprinter implements WorkspaceFingerprinter {
  async fingerprint(workspace: string): Promise<string> {
    const root = resolve(workspace);
    const insideWorkTree = await this.git(root, ["rev-parse", "--is-inside-work-tree"]);
    if (insideWorkTree.trim() !== "true") throw new Error(`${root} is not a Git worktree.`);

    const head = (await this.tryGit(root, ["rev-parse", "HEAD"]))?.trim() ?? "UNBORN";
    const status = await this.git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
    const files = this.parseChangedFiles(status).sort((left, right) => left.localeCompare(right));
    const contents = await Promise.all(files.map((file) => this.fileState(root, file)));
    return sha256(JSON.stringify({ head, status, files, contents }));
  }

  private async git(root: string, args: string[]): Promise<string> {
    const { stdout } = await execFileAsync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 });
    return stdout;
  }

  private async tryGit(root: string, args: string[]): Promise<string | undefined> {
    try {
      return await this.git(root, args);
    } catch {
      return undefined;
    }
  }

  private parseChangedFiles(status: string): string[] {
    const files = new Set<string>();
    const records = status.split("\0");
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      if (!record) continue;
      const code = record.slice(0, 2);
      const path = record.slice(3);
      if (path) files.add(path);
      if (code.includes("R") || code.includes("C")) {
        const originalPath = records[++index];
        if (originalPath) files.add(originalPath);
      }
    }
    return [...files];
  }

  private async fileState(root: string, file: string): Promise<{ file: string; content: string }> {
    const path = resolve(root, file);
    if (relative(root, path).startsWith("..")) return { file, content: "OUTSIDE_WORKSPACE" };
    try {
      return { file, content: sha256(await readFile(path)) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { file, content: "DELETED" };
      throw error;
    }
  }
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
