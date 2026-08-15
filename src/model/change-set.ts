export type ChangeKind = "source" | "test" | "build" | "docs" | "unknown";

export interface ChangeEntry {
  path: string;
  kind: ChangeKind;
  contentDigest: string;
}

export interface ChangeSet {
  id: string;
  projectRoot: string;
  base: { revision?: string; capturedAt: Date };
  entries: ChangeEntry[];
  confidence: "high" | "low";
  observedAt: Date;
}
