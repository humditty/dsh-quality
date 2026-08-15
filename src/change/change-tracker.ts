import { digest } from "../utils/digest.js";
import type { ChangeEntry, ChangeKind, ChangeSet } from "../model/change-set.js";
import { existsSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";

export interface ChangeObservation {
  agentId?: string;
  projectRoot: string;
  changedFiles: string[];
  success: boolean;
  source?: string;
  mayHaveMutated?: boolean;
  observedAt?: Date;
}

export interface ChangeSnapshotOptions {
  agentId?: string;
  projectRoot: string;
  confidence?: "high" | "low";
}

interface TrackedPath {
  path: string;
  revision: number;
  observedAt: Date;
}

interface TrackerState {
  paths: Map<string, TrackedPath>;
  lowConfidence: boolean;
}

export function classifyPath(path: string): ChangeKind {
  const normalized = path.replaceAll("\\", "/").toLowerCase();
  const base = normalized.split("/").at(-1) ?? normalized;
  if (normalized.startsWith("docs/") || /^(readme|changelog|contributing|license)(\.|$)/.test(base) || /\.(md|mdx|rst|txt)$/.test(base)) return "docs";
  if (["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "pom.xml", "build.gradle", "build.gradle.kts", "requirements.txt", "pyproject.toml", "gradle.properties"].includes(base)) return "build";
  if (/(^|\/)(test|tests|__tests__|spec)(\/|$)/.test(normalized) || /\.(test|spec)\.[^.]+$/.test(base)) return "test";
  if (/\.(ts|tsx|js|jsx|mjs|cjs|py|java|kt|kts|go|rs|rb|php|cs|cpp|cc|c|h|swift|vue|svelte)$/.test(base)) return "source";
  return "unknown";
}

export class ChangeTracker {
  private readonly paths = new Map<string, TrackerState>();
  private readonly bases = new Map<string, Date>();

  observe(observation: ChangeObservation): void {
    if (observation.source === "dsh-quality") return;
    const key = this.key(observation.agentId, observation.projectRoot);
    const observedAt = observation.observedAt ?? new Date();
    if (!this.bases.has(key)) this.bases.set(key, observedAt);
    const state = this.paths.get(key) ?? { paths: new Map<string, TrackedPath>(), lowConfidence: false };
    if (observation.mayHaveMutated && observation.changedFiles.length === 0) state.lowConfidence = true;
    for (const path of observation.changedFiles) {
      const previous = state.paths.get(path);
      state.paths.set(path, { path, revision: (previous?.revision ?? 0) + 1, observedAt });
    }
    this.paths.set(key, state);
  }

  snapshot(options: ChangeSnapshotOptions): ChangeSet {
    const key = this.key(options.agentId, options.projectRoot);
    const state = this.paths.get(key);
    const tracked = [...(state?.paths.values() ?? [])].sort((left, right) => left.path.localeCompare(right.path));
    const entries = tracked.map(({ path, revision }) => createChangeEntry(options.projectRoot, path, revision));
    const observedAt = new Date();
    const confidence = options.confidence ?? (state?.lowConfidence ? "low" : "high");
    const base = { capturedAt: this.bases.get(key) ?? observedAt };
    return createChangeSet(options.projectRoot, base, entries, confidence, observedAt);
  }

  reset(agentId: string | undefined, projectRoot: string): void {
    const key = this.key(agentId, projectRoot);
    this.paths.delete(key);
    this.bases.delete(key);
  }

  private key(agentId: string | undefined, projectRoot: string): string {
    return `${agentId ?? "default"}:${projectRoot}`;
  }

}

export function createChangeEntry(projectRoot: string, path: string, revision = 0): ChangeEntry {
  return {
    path,
    kind: classifyPath(path),
    contentDigest: digestPathContent(projectRoot, path, revision)
  };
}

export function createChangeSet(
  projectRoot: string,
  base: ChangeSet["base"],
  entries: ChangeEntry[],
  confidence: ChangeSet["confidence"],
  observedAt = new Date()
): ChangeSet {
  const normalizedEntries = [...entries].sort((left, right) => left.path.localeCompare(right.path));
  const id = `changeset:${digest({ projectRoot, base, entries: normalizedEntries, confidence }).slice(0, 16)}`;
  return { id, projectRoot, base, entries: normalizedEntries, confidence, observedAt };
}

function digestPathContent(projectRoot: string, path: string, revision: number): string {
  const root = resolve(projectRoot);
  const target = resolve(root, path);
  if (relative(root, target).startsWith("..")) return digest({ path, revision, outsideProjectRoot: true });
  try {
    if (existsSync(target)) return digest(readFileSync(target));
  } catch {
    // Fall back to the monotonic observation revision. Gate evaluation must remain available.
  }
  return digest({ path, revision });
}
