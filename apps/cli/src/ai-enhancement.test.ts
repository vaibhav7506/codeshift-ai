import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { resolveCLIAIConfiguration } from "./ai-enhancement.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("./index.js", import.meta.url));

test("CLI AI configuration reads the provider-specific BYOK environment key", () => {
  assert.deepEqual(
    resolveCLIAIConfiguration("openai", {
      OPENAI_API_KEY: "openai-test-key",
      OPENAI_MODEL: "test-model",
    }),
    {
      provider: "openai",
      apiKey: "openai-test-key",
      model: "test-model",
    },
  );

  assert.throws(
    () => resolveCLIAIConfiguration("gemini", {}),
    /AI features require BYOK\. Add GEMINI_API_KEY or run without --ai\./,
  );
  assert.throws(
    () =>
      resolveCLIAIConfiguration("anthropic", {
        ANTHROPIC_API_KEY: "anthropic-test-key",
      }),
    /Anthropic is not implemented yet/,
  );
});

test("AI migration fails before deterministic changes when the BYOK key is missing", async () => {
  const root = await mkdtemp(join(tmpdir(), "codeshift-ai-byok-"));

  try {
    await mkdir(join(root, "src", "utils"), { recursive: true });
    await writeFile(
      join(root, "src", "utils", "format.js"),
      "module.exports = format;\n",
      "utf8",
    );

    const environment = { ...process.env };
    delete environment.OPENAI_API_KEY;
    delete environment.GROQ_API_KEY;
    delete environment.GEMINI_API_KEY;
    delete environment.ANTHROPIC_API_KEY;

    let failedCommand:
      | {
          code?: number | string;
          stdout?: string;
          stderr?: string;
        }
      | undefined;

    try {
      await execFileAsync(
        process.execPath,
        [
          cliPath,
          "migrate",
          "--target",
          "js-to-ts",
          "--path",
          "src/utils",
          "--ai",
          "--provider",
          "openai",
        ],
        { cwd: root, env: environment },
      );
      assert.fail("Expected AI migration to require a BYOK key.");
    } catch (error) {
      failedCommand = error as typeof failedCommand;
    }

    assert.equal(failedCommand?.code, 1);
    assert.equal(failedCommand?.stdout, "");
    assert.match(
      failedCommand?.stderr ?? "",
      /AI features require BYOK\. Add OPENAI_API_KEY or run without --ai\./,
    );
    await access(join(root, "src", "utils", "format.js"));
    await assert.rejects(access(join(root, "src", "utils", "format.ts")));
    await assert.rejects(access(join(root, "tsconfig.json")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
