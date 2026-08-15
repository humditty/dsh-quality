import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GitWorkspaceFingerprinter } from "../src/workspace/git-workspace-fingerprinter.js";

function git(root: string, args: string[]): void {
  execFileSync("git", ["-C", root, ...args], { stdio: "ignore" });
}

function createWorkspace(): { root: string; dispose: () => void } {
  const root = mkdtempSync(join(tmpdir(), "dsh-quality-fingerprint-"));
  git(root, ["init"]);
  git(root, ["config", "user.name", "DSH Quality Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  writeFileSync(join(root, "app.ts"), "export const value = 1;\n");
  git(root, ["add", "app.ts"]);
  git(root, ["commit", "-m", "initial"]);
  return { root, dispose: () => rmSync(root, { recursive: true, force: true }) };
}

test("fingerprint is stable when the workspace is unchanged", async () => {
  const workspace = createWorkspace();
  try {
    const fingerprinter = new GitWorkspaceFingerprinter();
    assert.equal(await fingerprinter.fingerprint(workspace.root), await fingerprinter.fingerprint(workspace.root));
  } finally {
    workspace.dispose();
  }
});

test("fingerprint changes after modifying a tracked file", async () => {
  const workspace = createWorkspace();
  try {
    const fingerprinter = new GitWorkspaceFingerprinter();
    const before = await fingerprinter.fingerprint(workspace.root);
    writeFileSync(join(workspace.root, "app.ts"), "export const value = 2;\n");
    assert.notEqual(await fingerprinter.fingerprint(workspace.root), before);
  } finally {
    workspace.dispose();
  }
});

test("fingerprint changes after adding an untracked file", async () => {
  const workspace = createWorkspace();
  try {
    const fingerprinter = new GitWorkspaceFingerprinter();
    const before = await fingerprinter.fingerprint(workspace.root);
    writeFileSync(join(workspace.root, "added.ts"), "export const added = true;\n");
    assert.notEqual(await fingerprinter.fingerprint(workspace.root), before);
  } finally {
    workspace.dispose();
  }
});

test("fingerprint changes after deleting a tracked file", async () => {
  const workspace = createWorkspace();
  try {
    const fingerprinter = new GitWorkspaceFingerprinter();
    const before = await fingerprinter.fingerprint(workspace.root);
    unlinkSync(join(workspace.root, "app.ts"));
    assert.notEqual(await fingerprinter.fingerprint(workspace.root), before);
  } finally {
    workspace.dispose();
  }
});

test("fingerprint returns to its original value when content is restored", async () => {
  const workspace = createWorkspace();
  try {
    const fingerprinter = new GitWorkspaceFingerprinter();
    const original = await fingerprinter.fingerprint(workspace.root);
    writeFileSync(join(workspace.root, "app.ts"), "export const value = 2;\n");
    writeFileSync(join(workspace.root, "app.ts"), "export const value = 1;\n");
    assert.equal(await fingerprinter.fingerprint(workspace.root), original);
  } finally {
    workspace.dispose();
  }
});
