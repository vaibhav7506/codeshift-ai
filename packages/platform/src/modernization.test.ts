import assert from "node:assert/strict";
import test from "node:test";
import type { RepositoryAnalysis } from "@codeshift/shared";
import {
  compareApiBehaviour,
  compareFrontendBehaviour,
  createDefaultRecipeRegistry,
  assessHonoRuntimes,
  deprecatedDependencyReport,
  edgeRuntimeBlockers,
  generateTailwindSafeMode,
  generateTypedEnvironmentModule,
  transformCallbackWrapper,
  transformCommonJsModule,
  transformEslintConfig,
  transformExpressApplication,
  transformJestConfig,
  transformJestTest,
  transformReactClass,
} from "./index.js";

const analysis: RepositoryAnalysis = {
  repoUrl: "file:///fixture",
  owner: "local",
  repo: "fixture",
  defaultBranch: "main",
  packageManager: "npm",
  framework: "express",
  moduleSystem: "commonjs",
  totalFiles: 8,
  jsFiles: 5,
  tsFiles: 0,
  jsxFiles: 1,
  tsxFiles: 0,
  hasTsConfig: true,
  hasTests: true,
  hasBuildScript: true,
  hasLintScript: true,
  hasTypecheckScript: true,
  riskFactors: [],
  recommendedScopes: [
    {
      path: "src",
      reason: "Fixture scope",
      estimatedFiles: 6,
      risk: "MEDIUM",
    },
  ],
  readinessScore: 75,
  difficulty: "MEDIUM",
};

test("CommonJS to ESM converts static boundaries and preserves dynamic require", () => {
  const converted = transformCommonJsModule(
    [
      'const helper = require("./helper");',
      'const { join } = require("node:path");',
      "module.exports = helper;",
      "",
    ].join("\n"),
  );
  assert.match(converted.code, /import helper from "\.\/helper"/);
  assert.match(converted.code, /import \{ join \} from "node:path"/);
  assert.match(converted.code, /export default helper/);

  const dynamic = "const plugin = require(pluginName);\n";
  const preserved = transformCommonJsModule(dynamic);
  assert.equal(preserved.code, dynamic);
  assert.match(preserved.warnings?.[0] ?? "", /Dynamic require/);

  const json = 'const config = require("./config.json");\nmodule.exports = config;\n';
  const preservedJson = transformCommonJsModule(json);
  assert.match(preservedJson.code, /require\("\.\/config\.json"\)/);
  assert.match(preservedJson.warnings?.join(" ") ?? "", /JSON/);
});

test("Express to Hono preserves route status, body, and order for supported handlers", () => {
  const source = [
    'const express = require("express");',
    "const app = express();",
    'app.use(auth);',
    'app.get("/users", (req, res) => { res.status(201).json({ ok: true }); });',
    "module.exports = app;",
    "",
  ].join("\n");
  const result = transformExpressApplication(source);
  assert.match(result.code, /new Hono/);
  assert.match(result.code, /app\.use\(auth\)/);
  assert.match(result.code, /return c\.json\(\{ ok: true \}, 201\)/);
  assert.ok(result.code.indexOf("app.use") < result.code.indexOf('app.get("/users"'));

  const unsupported = `${source}app.use(require("express-session")({}));\n`;
  assert.equal(transformExpressApplication(unsupported).code, unsupported);

  const runtimes = assessHonoRuntimes(
    'const fs = require("fs"); app.get("/file", (_, res) => res.sendFile("a.txt"));',
  );
  assert.equal(runtimes.find((item) => item.runtime === "node")?.compatible, true);
  assert.equal(
    runtimes.find((item) => item.runtime === "cloudflare-workers")?.compatible,
    false,
  );
});

test("callback conversion produces awaited error propagation and rejects timing-sensitive APIs", () => {
  const source = [
    "function load(path, callback) {",
    "  readFile(path, (error, data) => {",
    "    if (error) return callback(error);",
    "    callback(null, data);",
    "  });",
    "}",
  ].join("\n");
  const result = transformCallbackWrapper(source);
  assert.match(result.code, /async function load\(path\)/);
  assert.match(result.code, /await readFileAsync\(path\)/);
  assert.match(result.code, /promisify\(readFile\)/);

  const emitter = 'stream.on("data", callback);\n';
  assert.equal(transformCallbackWrapper(emitter).code, emitter);
});

test("React class conversion maps state and mount cleanup while preserving error boundaries", () => {
  const source = [
    "class Counter extends React.Component {",
    "  state = { count: 0 };",
    "  componentDidMount() {",
    "    subscribe();",
    "  }",
    "  componentWillUnmount() {",
    "    unsubscribe();",
    "  }",
    "  render() {",
    "    return (<button>{this.state.count}</button>);",
    "  }",
    "}",
  ].join("\n");
  const result = transformReactClass(source);
  assert.match(result.code, /function Counter\(props\)/);
  assert.match(result.code, /useState\(0\)/);
  assert.match(result.code, /return \(\) =>/);
  assert.match(result.code, /unsubscribe\(\)/);

  const boundary =
    "class Boundary extends React.Component { componentDidCatch(error) {} render() { return (<div />); } }";
  assert.equal(transformReactClass(boundary).code, boundary);
});

test("CSS to Tailwind safe mode keeps CSS and generates reviewable utilities", () => {
  const css = ".button:hover { display: flex; font-weight: 600; color: var(--text); padding: 12px; }";
  const result = generateTailwindSafeMode(css);
  assert.equal(result.originalCss, css);
  assert.equal(result.safeMode, true);
  assert.deepEqual(result.selectors[0].utilities, [
    "hover:flex",
    "hover:font-semibold",
    "hover:text-[var(--text)]",
  ]);
  assert.deepEqual(result.selectors[0].unresolvedDeclarations, ["padding: 12px"]);
});

test("additional recipes generate bounded artifacts and assessment reports", () => {
  const eslint = transformEslintConfig(
    JSON.stringify({ extends: ["eslint:recommended"], rules: { semi: "error" } }),
  );
  assert.equal(eslint.code.includes("eslint:recommended"), true);
  assert.match(eslint.additionalChanges?.[0].code ?? "", /FlatCompat/);

  const jest = transformJestTest("const mock = jest.fn();\n");
  assert.match(jest.code, /import \{ vi \} from "vitest"/);
  assert.match(jest.code, /vi\.fn/);

  const jestConfig = transformJestConfig(
    "jest.config.js",
    'module.exports = { testEnvironment: "jsdom", moduleNameMapper: {} };\n',
  );
  assert.match(jestConfig.code, /moduleNameMapper/);
  assert.match(jestConfig.additionalChanges?.[0].code ?? "", /environment: "jsdom"/);
  assert.equal(jestConfig.warnings?.length, 1);

  const environment = generateTypedEnvironmentModule(["DATABASE_URL", "PORT"]);
  assert.match(environment, /DATABASE_URL: readRequired/);
  assert.doesNotMatch(environment, /console/);

  assert.deepEqual(
    deprecatedDependencyReport(
      JSON.stringify({ dependencies: { request: "^2.0.0" } }),
    )[0].name,
    "request",
  );
  assert.deepEqual(edgeRuntimeBlockers(['import fs from "node:fs";']), ["node:fs"]);
});

test("every Phase 2 recipe implements the full contract", async () => {
  const files = [
    { path: "src/app.js", content: 'const express = require("express");\nconst app = express();\nmodule.exports = app;\n' },
    { path: "src/app.test.js", content: "const fn = jest.fn();\n" },
    { path: "src/config.js", content: "process.env.DATABASE_URL;\n" },
    { path: "src/styles.css", content: ".box { display: flex; }\n" },
    { path: ".eslintrc.json", content: '{"rules":{}}' },
    { path: "package.json", content: '{"dependencies":{"request":"^2"}}' },
  ];
  const registry = createDefaultRecipeRegistry();

  for (const registration of registry
    .list()
    .filter((entry) => entry.metadata.id !== "js-to-ts")) {
    const recipe = registry.get(registration.metadata.id);
    const repositoryContext = { repositoryId: "fixture", analysis, files };
    const detection = await recipe.detect(repositoryContext);
    const assessment = await recipe.assess(repositoryContext);
    const plan = await recipe.plan({
      ...repositoryContext,
      approvedScope: ".",
    });
    const transformed = await recipe.transform({
      ...repositoryContext,
      approvedScope: ".",
      rootPath: ".",
      plan,
    });
    const validation = await recipe.validate({
      ...repositoryContext,
      plan,
      results: [{ command: "test", status: "PASSED", logs: "" }],
    });
    const explanation = await recipe.explain({
      ...repositoryContext,
      plan,
      warnings: transformed.warnings,
    });
    const rollback = await recipe.rollback({
      ...repositoryContext,
      checkpointId: "checkpoint-1",
      approvedBy: "reviewer-1",
    });

    assert.equal(typeof detection.detected, "boolean");
    assert.ok(assessment.score >= 0 && assessment.score <= 100);
    assert.equal(plan.target.length > 0, true);
    assert.equal(validation.passed, true);
    assert.equal(explanation.summary.length > 0, true);
    assert.equal(rollback.requiresApproval, true);
  }
});

test("API behavioural validation reports status and middleware regressions", () => {
  const baseline = [
    {
      method: "POST",
      path: "/users",
      status: 201,
      responseBody: { id: 1 },
      responseHeaders: { "content-type": "application/json", date: "before" },
      authenticationState: "user",
      middlewareTrace: ["auth", "validate"],
    },
  ];
  const migrated = [
    {
      ...baseline[0],
      status: 200,
      responseHeaders: { "content-type": "application/json", date: "after" },
      middlewareTrace: ["validate", "auth"],
    },
  ];
  const report = compareApiBehaviour(baseline, migrated);
  assert.equal(report.passed, false);
  assert.equal(report.routeParity.passed, 1);
  assert.match(report.differences[0].message, /201.*200/);
  assert.equal(report.middlewareParity.passed, 0);
});

test("frontend behavioural validation detects new console and style regressions", () => {
  const baseline = {
    route: "/",
    viewport: "desktop",
    screenshotHash: "same",
    domSnapshot: "<main>Ready</main>",
    consoleErrors: [] as string[],
    networkFailures: [] as string[],
    criticalInteractions: [{ name: "submit", passed: true }],
    computedStyles: { button: { color: "red" } },
    accessibilityViolations: [] as Array<{ rule: string; target: string }>,
  };
  const report = compareFrontendBehaviour(
    [baseline],
    [
      {
        ...baseline,
        consoleErrors: ["Hydration failed"],
        computedStyles: { button: { color: "blue" } },
      },
    ],
  );
  assert.equal(report.passed, false);
  assert.deepEqual(report.routes[0].newConsoleErrors, ["Hydration failed"]);
  assert.equal(report.routes[0].styleParity, false);
});
