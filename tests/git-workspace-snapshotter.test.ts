import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ChangeTracker } from "../src/change/change-tracker.js";
import { GitWorkspaceSnapshotter } from "../src/change/git-workspace-snapshotter.js";

function git(root: string, args: string[]): void {
  execFileSync("git", ["-C", root, ...args], { stdio: "ignore" });
}

test("GitWorkspaceSnapshotter includes tracked modifications and untracked files", () => {
  const root = mkdtempSync(join(tmpdir(), "dsh-quality-git-"));
  try {
    git(root, ["init"]);
    git(root, ["config", "user.name", "DSH Quality Test"]);
    git(root, ["config", "user.email", "test@example.invalid"]);
    writeFileSync(join(root, "src.ts"), "export const value = 1;\n");
    git(root, ["add", "src.ts"]);
    git(root, ["commit", "-m", "initial"]);
    writeFileSync(join(root, "src.ts"), "export const value = 2;\n");
    writeFileSync(join(root, "new-file.ts"), "export const added = true;\n");

    const observed = new ChangeTracker().snapshot({ projectRoot: root });
    const snapshot = new GitWorkspaceSnapshotter().snapshot(observed);
    assert.equal(snapshot.confidence, "high");
    assert.ok(snapshot.base.revision);
    assert.deepEqual(snapshot.entries.map((entry) => entry.path), ["new-file.ts", "src.ts"]);
    assert.notEqual(snapshot.entries[0].contentDigest, snapshot.entries[1].contentDigest);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("GitWorkspaceSnapshotter makes an untrusted observer fallback low confidence", () => {
  const tracker = new ChangeTracker();
  tracker.observe({ projectRoot: "/not-a-git-workspace", changedFiles: [], success: false, mayHaveMutated: true });
  const snapshot = new GitWorkspaceSnapshotter().snapshot(tracker.snapshot({ projectRoot: "/not-a-git-workspace" }));
  assert.equal(snapshot.confidence, "low");
});
