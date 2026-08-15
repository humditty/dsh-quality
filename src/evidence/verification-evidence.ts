export type VerificationStatus = "PASS" | "FAIL" | "ERROR";

export interface VerificationEvidence {
  id: string;
  type: "COMMAND";
  producer: string;
  workspaceFingerprint: string;
  command: string;
  status: VerificationStatus;
  exitCode?: number;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  stdout?: string;
  stderr?: string;
  failureFingerprint?: string;
}
