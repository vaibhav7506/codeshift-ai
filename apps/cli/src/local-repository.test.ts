import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { generateMigrationPlan } from "@codeshift/migrator/runtime";
import {
  analyzeLocalRepository,
  readAnalysisArtifact,
  writeAnalysisArtifact,
  writeMigrationPlanArtifact,
} from "./local-repository.js";

const execFileAsync = promisify(execFile);

test("local analysis and planning write artifacts without changing source files", async () => {
  const root = await mkdtemp(join(tmpdir(), "codeshift-cli-"));

  try {
    await mkdir(join(root, "src", "utils"), { recursive: true });
    await mkdir(join(root, "src", "routes"), { recursive: true });
    await mkdir(join(root, "node_modules", "ignored"), { recursive: true });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "legacy-service",
        scripts: {
          test: "node --test",
          lint: "eslint .",
        },
        dependencies: {
          express: "^5.0.0",
        },
      }),
      "utf8",
    );
    await writeFile(join(root, "package-lock.json"), "{}", "utf8");
    await writeFile(
      join(root, "src", "utils", "format.js"),
      [
        "function format(value) { return String(value); }",
        "module.exports = format;",
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(root, "src", "utils", "format.test.js"),
      "const format = require('./format');\n",
      "utf8",
    );
    await writeFile(
      join(root, "src", "utils", "complex.js"),
      "const { join } = require('node:path');\n",
      "utf8",
    );
    await writeFile(
      join(root, "src", "routes", "route.js"),
      "module.exports = route;\n",
      "utf8",
    );
    await writeFile(
      join(root, "node_modules", "ignored", "index.js"),
      "eval('ignored');\n",
      "utf8",
    );

    const sourceBefore = await readFile(
      join(root, "src", "utils", "format.js"),
      "utf8",
    );
    const analysis = await analyzeLocalRepository(root);

    assert.equal(analysis.framework, "express");
    assert.equal(analysis.packageManager, "npm");
    assert.equal(analysis.moduleSystem, "commonjs");
    assert.equal(analysis.jsFiles, 4);
    assert.equal(analysis.hasTests, true);
    assert.equal(analysis.hasLintScript, true);
    assert.equal(analysis.recommendedScopes[0]?.path, "src/utils");

    const analysisPath = await writeAnalysisArtifact(root, analysis);
    assert.equal(analysisPath, ".codeshift-ai/analysis.json");
    assert.deepEqual(await readAnalysisArtifact(root), analysis);

    const plan = generateMigrationPlan({
      analysis,
      selectedScope: "src/utils",
    });
    const planPath = await writeMigrationPlanArtifact(root, plan);
    assert.equal(planPath, ".codeshift-ai/migration-plan.json");

    const persistedPlan = JSON.parse(
      await readFile(join(root, ".codeshift-ai", "migration-plan.json"), "utf8"),
    ) as { selectedScope: string; steps: unknown[] };
    assert.equal(persistedPlan.selectedScope, "src/utils");
    assert.equal(persistedPlan.steps.length, 9);

    const cliPath = fileURLToPath(new URL("./index.js", import.meta.url));
    const analyzeCommand = await execFileAsync(
      process.execPath,
      [cliPath, "analyze"],
      { cwd: root },
    );
    assert.match(analyzeCommand.stdout, /Repository Analysis/);
    assert.match(analyzeCommand.stdout, /\.codeshift-ai\/analysis\.json/);

    const planCommand = await execFileAsync(
      process.execPath,
      [
        cliPath,
        "plan",
        "--target",
        "js-to-ts",
        "--path",
        "src/utils",
      ],
      { cwd: root },
    );
    assert.match(planCommand.stdout, /Migration Plan/);
    assert.match(
      planCommand.stdout,
      /\.codeshift-ai\/migration-plan\.json/,
    );
    assert.match(planCommand.stdout, /No source files were modified/);

    assert.equal(
      await readFile(join(root, "src", "utils", "format.js"), "utf8"),
      sourceBefore,
    );

    const migrateCommand = await execFileAsync(
      process.execPath,
      [
        cliPath,
        "migrate",
        "--target",
        "js-to-ts",
        "--path",
        "src/utils",
      ],
      { cwd: root },
    );
    assert.match(migrateCommand.stdout, /JavaScript -> TypeScript Migration/);
    assert.match(migrateCommand.stdout, /\.codeshift-ai\/patch\.diff/);
    assert.match(
      migrateCommand.stdout,
      /\.codeshift-ai\/migration-summary\.json/,
    );
    assert.match(migrateCommand.stdout, /Changes were not committed/);

    assert.equal(
      await readFile(join(root, "src", "utils", "format.ts"), "utf8"),
      [
        "function format(value) { return String(value); }",
        "export default format;",
        "",
      ].join("\n"),
    );
    assert.equal(
      await readFile(join(root, "src", "utils", "format.test.ts"), "utf8"),
      "import format from './format';\n",
    );
    assert.equal(
      await readFile(join(root, "src", "utils", "complex.ts"), "utf8"),
      "const { join } = require('node:path');\n",
    );
    assert.equal(
      await readFile(join(root, "src", "routes", "route.js"), "utf8"),
      "module.exports = route;\n",
    );

    const tsconfig = JSON.parse(
      await readFile(join(root, "tsconfig.json"), "utf8"),
    ) as {
      compilerOptions: Record<string, unknown>;
      include: string[];
    };
    assert.equal(tsconfig.compilerOptions.target, "ES2020");
    assert.equal(tsconfig.compilerOptions.moduleResolution, "Bundler");
    assert.equal(tsconfig.compilerOptions.allowJs, true);
    assert.equal(tsconfig.compilerOptions.checkJs, false);
    assert.deepEqual(tsconfig.include, ["src/**/*"]);

    const patch = await readFile(
      join(root, ".codeshift-ai", "patch.diff"),
      "utf8",
    );
    assert.match(patch, /rename from src\/utils\/format\.js/);
    assert.match(patch, /rename to src\/utils\/format\.ts/);
    assert.doesNotMatch(patch, /src\/routes\/route\.js/);

    const migrationSummary = JSON.parse(
      await readFile(
        join(root, ".codeshift-ai", "migration-summary.json"),
        "utf8",
      ),
    ) as {
      target: string;
      selectedScope: string;
      warnings: string[];
      tsconfigChanged: boolean;
    };
    assert.equal(migrationSummary.target, "JS_TO_TS");
    assert.equal(migrationSummary.selectedScope, "src/utils");
    assert.equal(migrationSummary.tsconfigChanged, true);
    assert.ok(
      migrationSummary.warnings.some((warning) =>
        warning.includes("complex CommonJS syntax"),
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
