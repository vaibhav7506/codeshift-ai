import assert from "node:assert/strict";
import test from "node:test";
import type { RepositoryAnalysis } from "@codeshift/shared";
import {
  InMemoryBackgroundJobQueue,
  InMemoryCampaignRepository,
  InMemoryCheckpointStore,
  buildRepositoryIntelligence,
  createDefaultRecipeRegistry,
  createMigrationCampaign,
  transitionCampaign,
} from "./index.js";

const analysis: RepositoryAnalysis = {
  repoUrl: "https://github.com/example/legacy",
  owner: "example",
  repo: "legacy",
  defaultBranch: "main",
  packageManager: "npm",
  framework: "express",
  moduleSystem: "commonjs",
  totalFiles: 5,
  jsFiles: 2,
  tsFiles: 0,
  jsxFiles: 0,
  tsxFiles: 0,
  hasTsConfig: false,
  hasTests: true,
  hasBuildScript: true,
  hasLintScript: true,
  hasTypecheckScript: false,
  riskFactors: [],
  recommendedScopes: [
    {
      path: "src/utils",
      reason: "Contained utility scope.",
      estimatedFiles: 1,
      risk: "LOW",
    },
  ],
  readinessScore: 70,
  difficulty: "MEDIUM",
};

test("default recipe registry exposes only the implemented JS to TS recipe", () => {
  const registry = createDefaultRecipeRegistry();
  assert.deepEqual(
    registry.list().map((entry) => entry.metadata.id),
    ["js-to-ts"],
  );
  assert.equal(registry.list({ includeDisabled: true }).length, 6);
  assert.equal(registry.get("js-to-ts").version, "1.0.0");
  assert.throws(() => registry.get("express-to-hono"), /not available/);
});

test("JS to TS recipe adapter preserves the existing migration plan contract", async () => {
  const recipe = createDefaultRecipeRegistry().get("js-to-ts");
  const plan = await recipe.plan({
    repositoryId: "repo-1",
    analysis,
    files: [],
    approvedScope: "src/utils",
  });

  assert.equal(plan.target, "JS_TO_TS");
  assert.equal(plan.selectedScope, "src/utils");
  assert.equal(plan.steps[0].id, "inspect-files");
});

test("campaigns are ordered, tenant-scoped, and transition explicitly", async () => {
  const campaign = createMigrationCampaign(
    {
      id: "campaign-1",
      organizationId: "org-1",
      workspaceId: "workspace-1",
      repositoryId: "repo-1",
      name: "Utilities modernization",
      selectedRecipes: [{ id: "js-to-ts", version: "1.0.0" }],
      approvedScope: { paths: ["src/utils"], protectedPaths: [".github/**"] },
      riskScore: 30,
      estimatedAffectedFiles: 3,
      validationRequirements: ["test", "typecheck"],
    },
    "2026-07-23T00:00:00.000Z",
  );
  const repository = new InMemoryCampaignRepository();
  await repository.create(campaign);

  assert.equal((await repository.list("workspace-1")).length, 1);
  assert.equal((await repository.list("workspace-2")).length, 0);
  assert.equal(
    transitionCampaign(campaign, "ANALYSING").status,
    "ANALYSING",
  );
  assert.throws(
    () => transitionCampaign(campaign, "COMPLETED"),
    /cannot transition/,
  );
});

test("repository intelligence produces structured graphs and explainable risk", () => {
  const report = buildRepositoryIntelligence(
    "repo-1",
    analysis,
    [
      {
        path: "src/app.js",
        content:
          "const express = require('express'); app.use(auth); app.get('/users', handler); process.env.API_URL;",
      },
      { path: "test/app.test.js", content: "require('../src/app');" },
    ],
    JSON.stringify({
      engines: { node: ">=20" },
      dependencies: { express: "^4.0.0", request: "^2.88.0" },
    }),
  );

  assert.equal(report.routes[0].path, "/users");
  assert.deepEqual(report.environmentVariables, ["API_URL"]);
  assert.equal(report.unsupportedDependencies[0].name, "request");
  assert.ok(report.risk.factors.every((factor) => factor.explanation.length > 0));
});

test("checkpoints verify hashes, require approval, and return restorable content", () => {
  const store = new InMemoryCheckpointStore();
  store.create({
    id: "checkpoint-1",
    campaignId: "campaign-1",
    stageId: "stage-1",
    files: [{ path: "src/app.js", content: "before" }],
    dependencyLockfiles: [{ path: "package-lock.json", content: "lock" }],
    validationBaseline: { test: "PASSED" },
  });

  assert.equal(
    store.verify("checkpoint-1", [{ path: "src/app.js", content: "after" }])
      .valid,
    false,
  );
  assert.throws(() => store.restore("checkpoint-1", ""), /approving actor/);
  assert.equal(
    store.restore("checkpoint-1", "reviewer-1").files[0].content,
    "before",
  );
});

test("background jobs are idempotent, retryable, cancellable, and redact logs", async () => {
  const queue = new InMemoryBackgroundJobQueue();
  const options = {
    id: "job-1",
    organizationId: "org-1",
    workspaceId: "workspace-1",
    idempotencyKey: "analysis:repo-1",
    correlationId: "correlation-1",
    timeoutMs: 1_000,
    maxAttempts: 2,
  };
  assert.equal(queue.enqueue(options).id, queue.enqueue({ ...options, id: "job-2" }).id);

  let attempts = 0;
  const result = await queue.run("job-1", async (context) => {
    attempts += 1;
    context.log("info", "token=top-secret");
    if (attempts === 1) throw new Error("temporary");
    context.reportProgress(50);
    return "done";
  });

  assert.equal(result.status, "SUCCEEDED");
  assert.equal(result.attempts, 2);
  assert.match(result.logs[0].message, /\[REDACTED\]/);
});
