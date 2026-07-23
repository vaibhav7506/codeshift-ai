import { validateRuntimeConfiguration } from "@codeshift/platform/enterprise-runtime";
import { secureJson } from "@/lib/enterprise-api";

export const runtime = "nodejs";

export function GET() {
  const environment = normalizeEnvironment(process.env.CODESHIFT_ENV);
  const result = validateRuntimeConfiguration({
    environment,
    publicBaseUrl: process.env.CODESHIFT_PUBLIC_URL ?? "http://localhost:3000",
    databaseUrl: process.env.DATABASE_URL,
    encryptionKey: process.env.CODESHIFT_ENCRYPTION_KEY,
    identitySecret: process.env.CODESHIFT_IDENTITY_SECRET,
    githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    logRetentionDays: numericEnvironment("CODESHIFT_LOG_RETENTION_DAYS", 30),
    auditRetentionDays: numericEnvironment("CODESHIFT_AUDIT_RETENTION_DAYS", 365),
    objectStorageLifecycleDays: numericEnvironment("CODESHIFT_OBJECT_LIFECYCLE_DAYS", 30),
  });
  return secureJson({
    status: result.valid ? "READY" : "NOT_READY",
    environment,
    checks: {
      configuration: result.valid,
      warnings: result.warnings,
      errors: result.errors,
    },
  }, result.valid ? 200 : 503);
}

function normalizeEnvironment(value: string | undefined): "development" | "test" | "staging" | "production" {
  return value === "production" || value === "staging" || value === "test" ? value : "development";
}

function numericEnvironment(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) ? value : fallback;
}
