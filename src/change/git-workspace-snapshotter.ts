import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import type { ChangeSet } from "../model/change-set.js";
import { createChangeEntry, createChangeSet } from "./change-tracker.js";

export interface WorkspaceSnapshotter {
  snapshot(observed: ChangeSet): ChangeSet;
}

export class GitWorkspaceSnapshotter implements WorkspaceSnapshotter {
  snapshot(observed: ChangeSet): ChangeSet {
    const root = resolve(observed.projectRoot);
    try {
      this.git(root, ["rev-parse", "--is-inside-work-tree"]);
      const revision = this.tryGit(root, ["rev-parse", "--verify", "HEAD"]);
      const changed = new Set<string>(observed.entries.map((entry) => entry.path));
      const diffArgs = revision ? ["diff", "--name-only", "-z", "HEAD", "--"] : ["diff", "--cached", "--name-only", "-z", "--"];
      for (const path of this.nullSeparated(this.git(root, diffArgs))) changed.add(path);
      for (const path of this.nullSeparated(this.git(root, ["ls-files", "--others", "--exclude-standard", "-z"]))) changed.add(path);
      const revisions = new Map(observed.entries.map((entry) => [entry.path, entry.contentDigest]));
      const entries = [...changed]
        .filter(Boolean)
        .map((path) => createChangeEntry(root, path, revisions.has(path) ? 1 : 0));
      return createChangeSet(root, { ...observed.base, revision: revision ?? undefined }, entries, observed.confidence, new Date());
    } catch {
      return createChangeSet(observed.projectRoot, observed.base, observed.entries, "low", new Date());
    }
  }

  private git(root: string, args: string[]): string {
    return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 5 * 1024 * 1024 }).trimEnd();
  }

  private tryGit(root: string, args: string[]): string | undefined {
    try {
      return this.git(root, args) || undefined;
    } catch {
      return undefined;
    }
  }

  private nullSeparated(value: string): string[] {
    return value.split("\0");
  }
}
