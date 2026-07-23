import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runRecipeCommand } from "./recipe-command.js";

test("recipe SDK CLI creates, validates, tests, and inspects a local recipe", async () => {
  const root = await mkdtemp(join(tmpdir(), "codeshift-recipe-sdk-"));
  const output: string[] = [];
  try {
    assert.equal(await runRecipeCommand(["create", "http-modernizer"], root, (text) => output.push(text)), 0);
    const manifestPath = join(
      root, ".codeshift-ai", "recipes", "http-modernizer", "recipe.manifest.json",
    );
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { id: string };
    assert.equal(manifest.id, "http-modernizer");
    assert.equal(await runRecipeCommand(["validate", "http-modernizer"], root, (text) => output.push(text)), 0);
    assert.equal(await runRecipeCommand(["test", "http-modernizer"], root, (text) => output.push(text)), 0);
    assert.equal(await runRecipeCommand(["inspect", "http-modernizer"], root, (text) => output.push(text)), 0);
    assert.ok(output.join("").includes("fixture contract passed"));
    assert.ok(output.join("").includes("Permissions: read-repository"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("recipe SDK CLI rejects traversal names before writing", async () => {
  await assert.rejects(runRecipeCommand(["create", "../escape"]), /kebab-case/);
});
