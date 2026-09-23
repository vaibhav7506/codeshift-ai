import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, unlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";

const scanner = fileURLToPath(new URL("./secret-scan.mjs", import.meta.url));
test("secret scan tolerates deleted tracked files and detects untracked secrets", () => {
  const directory = mkdtempSync(join(tmpdir(), "codeshift-secret-scan-"));
  try {
    execFileSync("git", ["init", "--quiet", directory]);
    writeFileSync(join(directory, "deleted.txt"), "safe baseline");
    execFileSync("git", ["-C", directory, "add", "deleted.txt"]);
    unlinkSync(join(directory, "deleted.txt"));
    writeFileSync(join(directory, ".gitignore"), "ignored.txt\n");
    const secret = "ghp_" + "a".repeat(36);
    writeFileSync(join(directory, "ignored.txt"), secret);
    const run = () => spawnSync(process.execPath, [scanner], { cwd: directory, encoding: "utf8" });
    const clean = run();
    assert.equal(clean.status, 0, clean.stderr);
    writeFileSync(join(directory, "new.txt"), secret);
    const detected = run();
    assert.equal(detected.status, 1);
    assert.match(detected.stderr, /GitHub token: new\.txt/);
    assert.ok(!detected.stderr.includes(secret));
    assert.ok(!detected.stderr.includes("ignored.txt"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
