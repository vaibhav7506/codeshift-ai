import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CLI_BINARY_NAME,
  CLI_COMMAND_MANIFEST,
  campaignCliCommand,
} from "@codeshift/shared";
import { formatHelp } from "./output.js";

test("CLI manifest binary matches package.json and drives help output", async () => {
  const packageJson = JSON.parse(
    await readFile(resolve(process.cwd(), "package.json"), "utf8"),
  ) as { bin?: Record<string, string> };
  assert.equal(Object.keys(packageJson.bin ?? {})[0], CLI_BINARY_NAME);
  const help = formatHelp();
  for (const command of CLI_COMMAND_MANIFEST) {
    assert.match(help, new RegExp(`\\b${command.command}\\b`));
    assert.match(help, new RegExp(escapeRegExp(command.usage)));
  }
});

test("campaign workflow is additive and contains every ordered handoff command", () => {
  assert.deepEqual(
    ["connect", "preflight", "execute", "validate", "report", "rollback", "create-pr"].map(
      (command) => campaignCliCommand(command).command,
    ),
    ["connect", "preflight", "execute", "validate", "report", "rollback", "create-pr"],
  );
});

test("campaign connect uses a temporary token placeholder without embedding a credential", () => {
  const usage = campaignCliCommand("connect").usage;
  assert.match(usage, /--token <temporary-token>/);
  assert.doesNotMatch(usage, /Bearer|sk-|api[_-]?key/i);
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
