import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { RepositoryAnalysis } from "@codeshift/shared";
import {
  generateMigrationPlan,
  MigrationPlanInputError,
} from "./index.js";
import {
  migrateJavaScriptToTypeScript,
  transformCommonJs,
} from "./migrate.js";

const baseAnalysis: RepositoryAnalysis = {
  repoUrl: "https://github.com/example/service",
  owner: "example",
  repo: "service",
  defaultBranch: "main",
  packageManager: "npm",
  framework: "express",
  moduleSystem: "commonjs",
  totalFiles: 70,
  jsFiles: 24,
  tsFiles: 2,
  jsxFiles: 0,
  tsxFiles: 0,
  hasTsConfig: true,
  hasTests: true,
  hasBuildScript: true,
  hasLintScript: false,
  hasTypecheckScript: true,
  riskFactors: [],
  recommendedScopes: [
    {
      path: "src/utils",
      reason: "Contained utilities.",
      estimatedFiles: 6,
      risk: "LOW",
    },
  ],
  readinessScore: 82,
  difficulty: "LOW",
};

test("generateMigrationPlan uses the first recommended scope by default", () => {
  const plan = generateMigrationPlan({ analysis: baseAnalysis });

  assert.equal(plan.target, "JS_TO_TS");
  assert.equal(plan.selectedScope, "src/utils");
  assert.equal(plan.estimatedRisk, "LOW");
  assert.equal(plan.affectedFilesEstimate, 6);
  assert.deepEqual(plan.validationCommands, [
    "npm test",
    "npm run build",
    "npm run typecheck",
  ]);
  assert.equal(plan.steps.length, 9);
  assert.ok(plan.steps.every((step) => step.status === "PENDING"));
  assert.ok(!Number.isNaN(Date.parse(plan.createdAt)));
});

test("generateMigrationPlan produces a stable id for the same scope", () => {
  const first = generateMigrationPlan({
    analysis: baseAnalysis,
    selectedScope: "src/utils",
  });
  const second = generateMigrationPlan({
    analysis: baseAnalysis,
    selectedScope: "src/utils",
  });

  assert.equal(first.id, second.id);
});

test("generateMigrationPlan marks sensitive scopes as high risk", () => {
  const plan = generateMigrationPlan({
    analysis: baseAnalysis,
    selectedScope: "src/auth",
  });

  assert.equal(plan.estimatedRisk, "HIGH");
  assert.equal(plan.affectedFilesEstimate, 24);
});

test("generateMigrationPlan rejects unsafe repository paths", () => {
  assert.throws(
    () =>
      generateMigrationPlan({
        analysis: baseAnalysis,
        selectedScope: "../outside",
      }),
    MigrationPlanInputError,
  );
  assert.throws(
    () =>
      generateMigrationPlan({
        analysis: baseAnalysis,
        selectedScope: ".",
      }),
    MigrationPlanInputError,
  );
});

test("transformCommonJs converts only unambiguous whole-line patterns", () => {
  const result = transformCommonJs(
    [
      'const helper = require("./helper");',
      'const { join } = require("node:path");',
      "module.exports = helper;",
      "exports.helper = helper;",
      "exports.alias = helper;",
      `const message = "require('not-a-module')";`,
      "// module.exports = ignored;",
      "/*",
      'const hidden = require("hidden");',
      "module.exports = hidden;",
      "*/",
      "",
    ].join("\n"),
    "src/utils/index.js",
  );

  assert.equal(
    result.code,
    [
      'import helper from "./helper";',
      'const { join } = require("node:path");',
      "export default helper;",
      "export { helper };",
      "exports.alias = helper;",
      `const message = "require('not-a-module')";`,
      "// module.exports = ignored;",
      "/*",
      'const hidden = require("hidden");',
      "module.exports = hidden;",
      "*/",
      "",
    ].join("\n"),
  );
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings[0] ?? "", /line 2/);
  assert.match(result.warnings[1] ?? "", /line 5/);
});

test("migrateJavaScriptToTypeScript changes only the selected scope and writes review artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "codeshift-migrator-"));

  try {
    await mkdir(join(root, "src", "utils"), { recursive: true });
    await mkdir(join(root, "src", "routes"), { recursive: true });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "legacy-service" }),
      "utf8",
    );
    await writeFile(
      join(root, "tsconfig.json"),
      [
        "{",
        "  // Preserve this project setting.",
        '  "compilerOptions": {',
        '    "target": "ES2019"',
        "  }",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(root, "src", "utils", "format.js"),
      [
        'const stringify = require("./stringify");',
        "function format(value) {",
        "  return stringify(value);",
        "}",
        "module.exports = format;",
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(root, "src", "utils", "widget.jsx"),
      "const Widget = () => <div>Widget</div>;\nexports.Widget = Widget;\n",
      "utf8",
    );
    await writeFile(
      join(root, "src", "utils", "legacy.jsx"),
      [
        'const html = "<div>not JSX</div>";',
        "// <section>also not JSX</section>",
        "module.exports = legacy;",
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(root, "src", "routes", "route.js"),
      "module.exports = route;\n",
      "utf8",
    );

    const result = await migrateJavaScriptToTypeScript({
      rootDir: root,
      selectedScope: "src/utils",
    });

    assert.deepEqual(result.summary.changedFiles, [
      "src/utils/format.ts",
      "src/utils/widget.tsx",
      "tsconfig.json",
    ]);
    assert.equal(result.summary.tsconfigChanged, true);
    assert.ok(
      result.summary.warnings.some((warning) =>
        warning.includes("legacy.jsx"),
      ),
    );
    assert.equal(
      await readFile(join(root, "src", "utils", "format.ts"), "utf8"),
      [
        'import stringify from "./stringify";',
        "function format(value) {",
        "  return stringify(value);",
        "}",
        "export default format;",
        "",
      ].join("\n"),
    );
    assert.equal(
      await readFile(join(root, "src", "routes", "route.js"), "utf8"),
      "module.exports = route;\n",
    );
    assert.equal(
      await readFile(join(root, "src", "utils", "legacy.jsx"), "utf8"),
      [
        'const html = "<div>not JSX</div>";',
        "// <section>also not JSX</section>",
        "module.exports = legacy;",
        "",
      ].join("\n"),
    );

    const tsconfig = await readFile(join(root, "tsconfig.json"), "utf8");
    assert.match(tsconfig, /Preserve this project setting/);
    assert.match(tsconfig, /"target": "ES2019"/);
    assert.match(tsconfig, /"allowJs": true/);
    assert.match(tsconfig, /"checkJs": false/);

    const patch = await readFile(
      join(root, ".codeshift-ai", "patch.diff"),
      "utf8",
    );
    assert.match(patch, /rename from src\/utils\/format\.js/);
    assert.match(patch, /rename to src\/utils\/format\.ts/);
    assert.doesNotMatch(patch, /^=+$/m);
    assert.doesNotMatch(patch, /src\/routes\/route\.js/);

    const persistedSummary = JSON.parse(
      await readFile(
        join(root, ".codeshift-ai", "migration-summary.json"),
        "utf8",
      ),
    ) as { target: string; selectedScope: string };
    assert.equal(persistedSummary.target, "JS_TO_TS");
    assert.equal(persistedSummary.selectedScope, "src/utils");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("migrateJavaScriptToTypeScript rejects unsafe artifact paths before changing source", async () => {
  const root = await mkdtemp(join(tmpdir(), "codeshift-migrator-safety-"));

  try {
    await mkdir(join(root, "src", "utils"), { recursive: true });
    await mkdir(join(root, ".codeshift-ai", "patch.diff"), {
      recursive: true,
    });
    const sourcePath = join(root, "src", "utils", "format.js");
    const source = "module.exports = format;\n";
    await writeFile(sourcePath, source, "utf8");

    await assert.rejects(
      migrateJavaScriptToTypeScript({
        rootDir: root,
        selectedScope: "src/utils",
      }),
      /patch\.diff must be a regular file/,
    );
    assert.equal(await readFile(sourcePath, "utf8"), source);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
