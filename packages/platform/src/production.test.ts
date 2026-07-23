import assert from "node:assert/strict";
import test from "node:test";
import {
  CircuitBreaker,
  InMemoryBackgroundJobQueue,
  InMemoryTelemetrySink,
  StructuredTelemetry,
  UsageMeter,
  evaluateHealth,
  retryWithBackoff,
  validateMigrationSequence,
  validateRecipeManifest,
  validateRuntimeConfiguration,
  withTransaction,
  personalPlan,
  calculateMigrationRisk,
} from "./index.js";

test("structured telemetry correlates spans, records metrics, and redacts sensitive attributes", () => {
  let now = 1_000;
  const sink = new InMemoryTelemetrySink();
  const telemetry = new StructuredTelemetry(sink, () => now);
  const span = telemetry.start({
    kind: "RECIPE_STAGE",
    name: "transform",
    correlationId: "correlation-1",
    attributes: { recipe: "js-to-ts", sourceCode: "must-not-leak", apiKey: "secret" },
  });
  now = 1_125;
  span.end(true, { changedFiles: 2 });
  const event = sink.list()[0];
  assert.equal(event.durationMs, 125);
  assert.equal(event.attributes.sourceCode, "[REDACTED]");
  assert.equal(event.attributes.apiKey, "[REDACTED]");
  assert.equal(telemetry.metrics()["RECIPE_STAGE.transform.count"], 1);
});

test("health aggregation distinguishes degraded and unhealthy dependencies", async () => {
  const degraded = await evaluateHealth([
    { name: "process", critical: true, check: async () => ({ healthy: true }) },
    { name: "github", critical: false, check: async () => ({ healthy: false }) },
  ]);
  assert.equal(degraded.status, "DEGRADED");
  const unhealthy = await evaluateHealth([
    { name: "database", critical: true, check: async () => ({ healthy: false }) },
  ]);
  assert.equal(unhealthy.status, "UNHEALTHY");
});

test("retry uses bounded exponential backoff and circuit breakers fail fast", async () => {
  const waits: number[] = [];
  const result = await retryWithBackoff(async (attempt) => {
    if (attempt < 3) throw new Error("temporary");
    return "ok";
  }, {
    maximumAttempts: 3, initialDelayMs: 10, maximumDelayMs: 100, multiplier: 2,
  }, async (milliseconds) => { waits.push(milliseconds); });
  assert.equal(result, "ok");
  assert.deepEqual(waits, [10, 20]);

  const breaker = new CircuitBreaker(2, 1_000, () => 100);
  await assert.rejects(breaker.execute(async () => { throw new Error("provider"); }));
  await assert.rejects(breaker.execute(async () => { throw new Error("provider"); }));
  assert.equal(breaker.status(), "OPEN");
  await assert.rejects(breaker.execute(async () => "unreachable"), /circuit is open/);
});

test("jobs dead-letter after bounded retries and can be resumed", async () => {
  const queue = new InMemoryBackgroundJobQueue(10);
  queue.enqueue({
    id: "job-production", organizationId: "org", workspaceId: "ws",
    idempotencyKey: "key", correlationId: "correlation", timeoutMs: 1_000, maxAttempts: 2,
  });
  const failed = await queue.run("job-production", async () => {
    throw new Error("token=must-not-leak");
  });
  assert.equal(failed.status, "FAILED");
  assert.equal(queue.deadLetters().length, 1);
  assert.equal(JSON.stringify(failed).includes("must-not-leak"), false);
  assert.equal(queue.resume("job-production").status, "QUEUED");
});

test("usage is tenant scoped and configurable entitlements fail before overage", () => {
  const meter = new UsageMeter();
  meter.record({
    organizationId: "org", workspaceId: "ws", metric: "CAMPAIGNS",
    quantity: 19, timestamp: "2026-07-24T00:00:00.000Z", correlationId: "request",
  });
  assert.doesNotThrow(() => meter.enforce("org", "ws", "CAMPAIGNS", 1, personalPlan));
  assert.throws(() => meter.enforce("org", "ws", "CAMPAIGNS", 2, personalPlan), /would be exceeded/);
  assert.equal(meter.total("other", "ws", "CAMPAIGNS"), 0);
});

test("production configuration requires durable TLS services and strong secrets", () => {
  const invalid = validateRuntimeConfiguration({
    environment: "production",
    publicBaseUrl: "http://example.com",
    logRetentionDays: 30,
    auditRetentionDays: 365,
    objectStorageLifecycleDays: 30,
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length >= 5);
  const valid = validateRuntimeConfiguration({
    environment: "production",
    publicBaseUrl: "https://codeshift.example.com",
    databaseUrl: "postgres://db.example.com/codeshift?sslmode=verify-full",
    encryptionKey: "a".repeat(32),
    identitySecret: "b".repeat(32),
    githubWebhookSecret: "c".repeat(32),
    logRetentionDays: 30,
    auditRetentionDays: 365,
    objectStorageLifecycleDays: 30,
  });
  assert.equal(valid.valid, true);
});

test("recipe SDK validates versioned permissions and compatibility metadata", () => {
  const validation = validateRecipeManifest({
    manifestVersion: "1",
    id: "my-recipe",
    name: "My Recipe",
    version: "1.0.0",
    description: "A controlled recipe.",
    entrypoint: "src/index.ts",
    engineCompatibility: ">=0.1.0 <1.0.0",
    runtime: "node20",
    permissions: ["read-repository"],
    capabilities: ["detect", "plan"],
    validationCommands: ["npm test"],
    fixtureDirectory: "fixtures",
    filesItMayModify: ["src/**"],
    signedPackageRequired: false,
  });
  assert.equal(validation.valid, true);
  assert.equal(validateRecipeManifest({ id: "../escape" }).valid, false);
});

test("transaction boundaries rollback partial failures and migration ordering is validated", async () => {
  const actions: string[] = [];
  await assert.rejects(withTransaction(async () => ({
    commit: async () => { actions.push("commit"); },
    rollback: async () => { actions.push("rollback"); },
  }), async () => {
    throw new Error("partial failure");
  }));
  assert.deepEqual(actions, ["rollback"]);
  assert.doesNotThrow(() => validateMigrationSequence([
    { id: "0001_initial", checksum: "a".repeat(64), apply: async () => {}, rollback: async () => {} },
    { id: "0002_audit", checksum: "b".repeat(64), apply: async () => {}, rollback: async () => {} },
  ]));
});

test("risk scoring is explainable and never reduced by AI confidence", () => {
  const base = {
    affectedFiles: 30, dependencyFanIn: 12, complexity: 40, testCoveragePercent: 20,
    authentication: true, payments: false, database: true, runtimeChange: true,
    frameworkChange: true, unsupportedDependencies: 2, dynamicBehaviour: true,
    reflection: false, nativeApis: false, windowsOnlyDependencies: false,
    missingTests: true, migrationConfidence: 0.6, historicalFailures: 2,
  };
  const lowAi = calculateMigrationRisk({ ...base, aiConfidence: 0.1 });
  const highAi = calculateMigrationRisk({ ...base, aiConfidence: 0.99 });
  assert.equal(lowAi.score, highAi.score);
  assert.equal(lowAi.level, "CRITICAL");
  assert.ok(lowAi.factors.some((factor) => factor.name === "Database"));
});
