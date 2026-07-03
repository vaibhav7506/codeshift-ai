import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeRepositoryInput,
  parseGitHubRepoUrl,
  RepositoryInputError,
  type RepositoryFileEntry,
} from "./index.js";

test("parseGitHubRepoUrl accepts supported repository forms", () => {
  assert.deepEqual(
    parseGitHubRepoUrl("https://github.com/expressjs/express"),
    { owner: "expressjs", repo: "express" },
  );
  assert.deepEqual(parseGitHubRepoUrl("github.com/vercel/next.js"), {
    owner: "vercel",
    repo: "next.js",
  });
  assert.deepEqual(parseGitHubRepoUrl("facebook/react.git"), {
    owner: "facebook",
    repo: "react",
  });
});

test("parseGitHubRepoUrl rejects unsupported hosts and repository subpaths", () => {
  assert.throws(
    () => parseGitHubRepoUrl("https://example.com/owner/repo"),
    RepositoryInputError,
  );
  assert.throws(
    () => parseGitHubRepoUrl("https://github.com/owner/repo/issues"),
    RepositoryInputError,
  );
});

test("analyzeRepositoryInput detects a prepared ESM Express repository", () => {
  const analysis = analyzeRepositoryInput({
    repoUrl: "https://github.com/example/service",
    owner: "example",
    repo: "service",
    defaultBranch: "main",
    fileTree: [
      { path: "package.json", type: "blob" },
      { path: "package-lock.json", type: "blob" },
      { path: "tsconfig.json", type: "blob" },
      {
        path: "src/utils/dates.js",
        type: "blob",
        content: "export const today = () => new Date();",
      },
      { path: "src/utils/dates.test.js", type: "blob" },
    ],
    packageJsonText: JSON.stringify({
      type: "module",
      scripts: {
        test: "node --test",
        build: "tsc",
        lint: "eslint .",
        typecheck: "tsc --noEmit",
      },
      dependencies: { express: "^5.0.0" },
      devDependencies: { typescript: "^5.0.0" },
    }),
  });

  assert.equal(analysis.framework, "express");
  assert.equal(analysis.packageManager, "npm");
  assert.equal(analysis.moduleSystem, "esm");
  assert.equal(analysis.readinessScore, 100);
  assert.equal(analysis.difficulty, "LOW");
  assert.equal(analysis.recommendedScopes[0]?.path, "src/utils");
});

test("analyzeRepositoryInput penalizes large mixed-module repositories", () => {
  const generatedFiles: RepositoryFileEntry[] = Array.from(
    { length: 101 },
    (_, index) => ({
      path: `src/legacy/file-${index}.js`,
      type: "blob",
      content: index === 0 ? "const plugin = require(pluginName);" : undefined,
    }),
  );
  const analysis = analyzeRepositoryInput({
    repoUrl: "https://github.com/example/legacy",
    owner: "example",
    repo: "legacy",
    defaultBranch: "main",
    fileTree: [{ path: "package.json", type: "blob" }, ...generatedFiles],
    packageJsonText: JSON.stringify({ type: "module" }),
  });

  assert.equal(analysis.moduleSystem, "mixed");
  assert.equal(analysis.difficulty, "HIGH");
  assert.equal(analysis.readinessScore, 0);
  assert.ok(
    analysis.riskFactors.some((risk) => risk.id === "dynamic-require"),
  );
  assert.ok(
    analysis.riskFactors.some((risk) => risk.id === "large-js-surface"),
  );
});
