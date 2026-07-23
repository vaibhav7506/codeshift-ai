import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import test from "node:test";
import {
  AppendOnlyAuditLog,
  EncryptedAiCredentialVault,
  InMemoryGovernanceRepository,
  RunnerRegistry,
  SlidingWindowRateLimiter,
  approveRequest,
  assertPullRequestGate,
  assertSafeRepositoryUrl,
  authorize,
  bootstrapPersonalWorkspace,
  defaultRunnerIsolationPolicy,
  evaluateWorkspacePolicy,
  verifyWebhookSignature,
  type ApprovalRequest,
  type WorkspacePolicy,
} from "./index.js";

test("personal workspace remains compatible and grants its owner server permissions", () => {
  const repository = new InMemoryGovernanceRepository();
  const personal = bootstrapPersonalWorkspace("user-1", "2026-07-24T00:00:00.000Z");
  repository.saveOrganization(personal.organization);
  repository.saveWorkspace(personal.workspace);
  repository.saveMembership(personal.membership);

  const membership = authorize(repository, {
    organizationId: personal.organization.id,
    workspaceId: personal.workspace.id,
    userId: "user-1",
  }, "CAMPAIGN_MANAGE");

  assert.deepEqual(membership.roles, ["OWNER"]);
  assert.equal(personal.workspace.kind, "PERSONAL");
});

test("tenant boundaries reject cross-organization workspace access", () => {
  const repository = new InMemoryGovernanceRepository();
  const personal = bootstrapPersonalWorkspace("user-1");
  repository.saveOrganization(personal.organization);
  repository.saveWorkspace(personal.workspace);
  repository.saveMembership(personal.membership);

  assert.throws(() => repository.getWorkspace({
    organizationId: "another-organization",
    workspaceId: personal.workspace.id,
  }), /outside the active tenant/);
});

test("RBAC denies permissions that are not assigned to a role", () => {
  const repository = new InMemoryGovernanceRepository();
  repository.saveOrganization({ id: "org", name: "Org", createdAt: "now" });
  repository.saveWorkspace({
    id: "ws", organizationId: "org", name: "Workspace", kind: "ORGANIZATION",
    retentionDays: 30, createdAt: "now",
  });
  repository.saveMembership({
    organizationId: "org", workspaceId: "ws", userId: "viewer",
    roles: ["READ_ONLY"], status: "ACTIVE",
  });
  assert.throws(
    () => authorize(repository, {
      organizationId: "org", workspaceId: "ws", userId: "viewer",
    }, "RUNNER_MANAGE"),
    /Permission RUNNER_MANAGE is required/,
  );
});

test("high-risk execution requires two distinct approvals and forbids self-approval", () => {
  const request: ApprovalRequest = {
    id: "approval-1", organizationId: "org", workspaceId: "ws",
    authorId: "author", riskScore: 90, category: "STANDARD",
    validationPassed: true, approvals: [], status: "PENDING",
  };
  assert.throws(
    () => approveRequest(request, { userId: "author", roles: ["APPROVER"] }),
    /cannot approve/,
  );
  const first = approveRequest(request, {
    userId: "approver-1", roles: ["APPROVER"], decidedAt: "2026-07-24T00:00:01.000Z",
  });
  assert.equal(first.status, "PENDING");
  assert.throws(() => assertPullRequestGate({
    approval: first, policyAllowed: true, validationPassed: true,
  }), /completed approval/);
  const second = approveRequest(first, {
    userId: "approver-2", roles: ["APPROVER"], decidedAt: "2026-07-24T00:00:02.000Z",
  });
  assert.equal(second.status, "APPROVED");
  assert.doesNotThrow(() => assertPullRequestGate({
    approval: second, policyAllowed: true, validationPassed: true,
  }));
});

test("specialized changes require a specialist approval", () => {
  const request: ApprovalRequest = {
    id: "approval-2", organizationId: "org", workspaceId: "ws",
    authorId: "author", riskScore: 20, category: "DATABASE",
    validationPassed: true, approvals: [], status: "PENDING",
  };
  assert.throws(
    () => approveRequest(request, { userId: "approver", roles: ["APPROVER"] }),
    /DATABASE_REVIEWER/,
  );
  assert.equal(approveRequest(request, {
    userId: "db-approver", roles: ["APPROVER", "DATABASE_REVIEWER"],
  }).status, "APPROVED");
});

test("workspace policy blocks protected database changes and missing validation", () => {
  const policy: WorkspacePolicy = {
    allowedRepositories: ["github.com/acme/*"],
    allowedBranches: ["migration/*"],
    protectedFiles: [".github/*"],
    maximumAffectedFiles: 20,
    maximumRiskScore: 80,
    requiredTests: ["test", "typecheck"],
    requiredReviewers: 2,
    allowedRecipes: ["js-to-ts"],
    allowedAiProviders: ["openai"],
    allowSourceCodeSharing: false,
    retentionDays: 30,
    blockVulnerabilities: true,
    allowedLicenses: ["MIT"],
    protectDatabaseFiles: true,
  };
  const result = evaluateWorkspacePolicy(policy, {
    repository: "github.com/acme/service", branch: "migration/typescript",
    affectedFiles: ["src/db/schema.sql"], riskScore: 40, tests: ["test"],
    reviewerCount: 2, recipe: "js-to-ts", sharesSourceCode: false,
    vulnerabilities: 0, licenses: ["MIT"],
  });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.violations.sort(), ["DATABASE_FILE_PROTECTED", "REQUIRED_TEST_MISSING"]);
});

test("runner pairing tokens are one-time and revoked runners reject heartbeats", () => {
  const registry = new RunnerRegistry();
  const token = registry.createPairingToken("org", "ws", 1_000);
  const registration = registry.register(token, {
    id: "runner-1", identity: "spiffe://codeshift/runner-1", labels: ["linux"],
    runtimes: ["node20", "dotnet8"], capacity: 2, version: "1.0.0",
  }, 2_000);
  assert.ok(registration.credential.length > 32);
  assert.throws(() => registry.register(token, {
    id: "runner-2", identity: "second", labels: [], runtimes: [], capacity: 1, version: "1",
  }, 3_000), /already used/);
  registry.revoke("runner-1", "org", "ws");
  assert.throws(
    () => registry.heartbeat("runner-1", "org", "ws", registration.credential),
    /revoked/,
  );
  assert.equal(defaultRunnerIsolationPolicy.persistRepository, false);
});

test("audit log is tenant-scoped, redacts secrets, and verifies its hash chain", () => {
  const audit = new AppendOnlyAuditLog();
  audit.append({
    id: "event-1", organizationId: "org", workspaceId: "ws", actorId: "user",
    action: "AI_KEY_ROTATED", resource: "credential/1",
    timestamp: "2026-07-24T00:00:00.000Z", requestId: "req-1",
    result: "SUCCESS", next: { apiKey: "must-not-leak", provider: "openai" },
  });
  const event = audit.list("org", "ws")[0];
  assert.equal(event.next?.apiKey, "[REDACTED]");
  assert.equal(JSON.stringify(event).includes("must-not-leak"), false);
  assert.equal(audit.list("another", "ws").length, 0);
  assert.equal(audit.verify(), true);
});

test("BYOK credentials are encrypted, tenant scoped, redacted, rotatable, and revocable", () => {
  const vault = new EncryptedAiCredentialVault(randomBytes(32));
  vault.store({
    id: "key-1", organizationId: "org", workspaceId: "ws", provider: "openai",
    model: "configured-model", apiKey: "sk-secret-one", sourceCodeConsent: false,
    retentionDays: 0,
  }, "2026-07-24T00:00:00.000Z");
  assert.equal(vault.describe("key-1", "org", "ws").key, "••••••••");
  assert.equal(vault.resolve("key-1", "org", "ws"), "sk-secret-one");
  vault.rotate("key-1", "org", "ws", "sk-secret-two");
  assert.equal(vault.resolve("key-1", "org", "ws"), "sk-secret-two");
  assert.throws(() => vault.resolve("key-1", "another", "ws"), /active tenant/);
  vault.disable("key-1", "org", "ws");
  assert.throws(() => vault.resolve("key-1", "org", "ws"), /disabled/);
});

test("webhook, SSRF, and rate-limit controls fail closed", () => {
  const body = "{\"action\":\"push\"}";
  const secret = "webhook-secret";
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  assert.equal(verifyWebhookSignature(body, signature, secret), true);
  assert.equal(verifyWebhookSignature(body, `${signature.slice(0, -1)}0`, secret), false);
  assert.equal(assertSafeRepositoryUrl(
    "https://github.com/acme/repository", ["github.com"],
  ).hostname, "github.com");
  assert.throws(() => assertSafeRepositoryUrl("http://127.0.0.1/admin", ["127.0.0.1"]), /not permitted/);

  const limiter = new SlidingWindowRateLimiter(2, 1_000);
  assert.equal(limiter.allow("user", 1_000), true);
  assert.equal(limiter.allow("user", 1_100), true);
  assert.equal(limiter.allow("user", 1_200), false);
});
