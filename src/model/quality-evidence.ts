import type { QualityIssue } from "./quality-issue.js";

export type ProviderOutcome = "PASS" | "FAIL" | "ERROR" | "SKIPPED";
export type EvidenceFreshness = "FRESH" | "STALE" | "UNVERIFIABLE";

export interface QualityEvidence {
  id: string;
  obligationId: string;
  kind: "test";
  producer: { id: string; version?: string };
  outcome: ProviderOutcome;
  scope: string[];
  inputDigest: string;
  planDigest: string;
  observedAt: Date;
  durationMs: number;
  provenance: {
    commandId: string;
    cwd: string;
    exitCode?: number;
    timedOut: boolean;
  };
  summary: string;
  issues: QualityIssue[];
  logRef?: string;
}
