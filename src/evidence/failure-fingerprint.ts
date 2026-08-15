import { createHash } from "node:crypto";
import type { VerificationEvidence } from "./verification-evidence.js";

const ANSI = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const ISO_TIME = /\b\d{4}-\d{2}-\d{2}[T ][0-2]\d:[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g;
const TEMP_DIRECTORY = /(?:\/private)?\/tmp\/[\w./-]+/g;

export function createFailureFingerprint(evidence: VerificationEvidence): string | undefined {
  if (evidence.status === "PASS") return undefined;
  const content = normalizeFailureOutput([
    String(evidence.exitCode ?? "unknown"),
    tail(evidence.stderr ?? "", 4_000),
    tail(evidence.stdout ?? "", 4_000)
  ].join("\n"));
  return createHash("sha256").update(content).digest("hex");
}

export function normalizeFailureOutput(value: string): string {
  return value
    .replace(ANSI, "")
    .replace(ISO_TIME, "<time>")
    .replace(UUID, "<uuid>")
    .replace(TEMP_DIRECTORY, "<tmp>")
    .replace(/\s+/g, " ")
    .trim();
}

export function tail(value: string, maxChars: number): string {
  return value.length <= maxChars ? value : value.slice(-maxChars);
}
