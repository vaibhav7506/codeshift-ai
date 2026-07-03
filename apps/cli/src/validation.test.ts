import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import type { ValidationResult } from "@codeshift/shared";
import { detectPackageManager } from "./validation.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("./index.js", import.meta.url));

test("validation package-manager detection follows lockfile priority", async () => {
  const root = await mkdtemp(join(tmpdir(), "codeshift-validation-manager-"));

  try {
    await writeFile(join(root, "package-lock.json"), "{}", "utf8");
    assert.equal(await detectPackageManager(root), "npm");

    await writeFile(join(root, "yarn.lock"), "", "utf8");
    assert.equal(await detectPackageManager(root), "yarn");

    await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: 9\n", "utf8");
    assert.equal(await detectPackageManager(root), "pnpm");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("validation falls back to npm with a warning when package.json has no lockfile", async () => {
  const root = await mkdtemp(join(tmpdir(), "codeshift-validation-fallback-"));

  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "validation-fallback-fixture",
        scripts: {
          test: "node pass.cjs",
        },
      }),
      "utf8",
    );
    await writeFile(
      join(root, "pass.cjs"),
      'console.log("fallback passed");\n',
      "utf8",
    );

    assert.equal(await detectPackageManager(root), "npm");

    const command = await execFileAsync(
      process.execPath,
      [cliPath, "validate"],
      { cwd: root },
    );

    assert.match(
      command.stdout,
      /No supported lockfile was found; defaulting to npm/,
    );
    assert.match(command.stdout, /PASSED\s+npm run test/);

    const logs = await readFile(
      join(root, ".codeshift-ai", "validation-logs.txt"),
      "utf8",
    );
    assert.match(logs, /No supported lockfile was found/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("validation returns a clean error when package.json is missing", async () => {
  const root = await mkdtemp(join(tmpdir(), "codeshift-validation-no-package-"));

  try {
    await assert.rejects(
      execFileAsync(process.execPath, [cliPath, "validate"], {
        cwd: root,
      }),
      (error: unknown) => {
        assert.equal(typeof error, "object");
        assert.notEqual(error, null);
        assert.match(
          String((error as { stderr?: string }).stderr),
          /No package\.json was found in the current directory/,
        );
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("validate runs available scripts, continues after failure, and saves artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "codeshift-validation-"));

  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "validation-fixture",
        scripts: {
          test: "node pass.cjs",
          build: "node fail.cjs",
          typecheck: "node after-failure.cjs",
        },
      }),
      "utf8",
    );
    await writeFile(join(root, "package-lock.json"), "{}", "utf8");
    await writeFile(
      join(root, "pass.cjs"),
      'console.log("tests passed");\n',
      "utf8",
    );
    await writeFile(
      join(root, "fail.cjs"),
      'console.error("build failed"); process.exitCode = 2;\n',
      "utf8",
    );
    await writeFile(
      join(root, "after-failure.cjs"),
      'console.log("typecheck still ran");\n',
      "utf8",
    );

    let failedCommand:
      | {
          code?: number | string;
          stdout?: string;
          stderr?: string;
        }
      | undefined;

    try {
      await execFileAsync(process.execPath, [cliPath, "validate"], {
        cwd: root,
      });
      assert.fail("Expected validation to return a failing exit code.");
    } catch (error) {
      failedCommand = error as typeof failedCommand;
    }

    assert.equal(failedCommand?.code, 1);
    assert.match(failedCommand?.stdout ?? "", /PASSED\s+npm run test/);
    assert.match(failedCommand?.stdout ?? "", /FAILED\s+npm run build/);
    assert.match(
      failedCommand?.stdout ?? "",
      /PASSED\s+npm run typecheck/,
    );
    assert.match(failedCommand?.stdout ?? "", /SKIPPED\s+npm run lint/);
    assert.match(failedCommand?.stdout ?? "", /Overall\s+FAILED/);

    const results = JSON.parse(
      await readFile(
        join(root, ".codeshift-ai", "validation-result.json"),
        "utf8",
      ),
    ) as ValidationResult[];

    assert.equal(results.length, 4);
    assert.deepEqual(
      results.map(({ command, status }) => ({ command, status })),
      [
        { command: "npm run test", status: "PASSED" },
        { command: "npm run build", status: "FAILED" },
        { command: "npm run typecheck", status: "PASSED" },
        { command: "npm run lint", status: "SKIPPED" },
      ],
    );
    assert.match(results[0]?.logs ?? "", /tests passed/);
    assert.match(results[1]?.logs ?? "", /build failed/);
    assert.match(results[2]?.logs ?? "", /typecheck still ran/);
    assert.match(results[3]?.logs ?? "", /not defined/);
    assert.equal(typeof results[0]?.durationMs, "number");
    assert.equal(results[3]?.durationMs, undefined);

    const logs = await readFile(
      join(root, ".codeshift-ai", "validation-logs.txt"),
      "utf8",
    );
    assert.match(logs, /Overall: FAILED/);
    assert.match(logs, /tests passed/);
    assert.match(logs, /build failed/);
    assert.match(logs, /typecheck still ran/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test(
  "Windows npm validation uses the command shim without resolving npm-cli.js",
  { skip: process.platform !== "win32" },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "codeshift-validation-windows-"));

    try {
      await writeFile(
        join(root, "package.json"),
        JSON.stringify({
          name: "validation-windows-fixture",
          scripts: {
            test: "node pass.cjs",
          },
        }),
        "utf8",
      );
      await writeFile(join(root, "package-lock.json"), "{}", "utf8");
      await writeFile(
        join(root, "pass.cjs"),
        'console.log("windows npm shim passed");\n',
        "utf8",
      );

      const command = await execFileAsync(
        process.execPath,
        [cliPath, "validate"],
        {
          cwd: root,
          env: {
            ...process.env,
            npm_execpath: join(root, "missing", "npm-cli.js"),
          },
        },
      );

      assert.match(command.stdout, /PASSED\s+npm run test/);
      assert.doesNotMatch(command.stdout, /npm JavaScript entry point/);

      const results = JSON.parse(
        await readFile(
          join(root, ".codeshift-ai", "validation-result.json"),
          "utf8",
        ),
      ) as ValidationResult[];
      assert.equal(results[0]?.status, "PASSED");
      assert.match(results[0]?.logs ?? "", /windows npm shim passed/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

test("validate passes overall when available scripts pass and the rest are skipped", async () => {
  const root = await mkdtemp(join(tmpdir(), "codeshift-validation-pass-"));

  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "validation-pass-fixture",
        scripts: {
          test: "node pass.cjs",
        },
      }),
      "utf8",
    );
    await writeFile(join(root, "package-lock.json"), "{}", "utf8");
    await writeFile(
      join(root, "pass.cjs"),
      'console.log("all good");\n',
      "utf8",
    );

    const command = await execFileAsync(
      process.execPath,
      [cliPath, "validate"],
      { cwd: root },
    );

    assert.match(command.stdout, /PASSED\s+npm run test/);
    assert.match(command.stdout, /Overall\s+PASSED/);
    assert.equal(command.stderr, "");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
