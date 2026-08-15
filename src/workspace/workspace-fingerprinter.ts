export interface WorkspaceFingerprinter {
  fingerprint(workspace: string): Promise<string>;
}
