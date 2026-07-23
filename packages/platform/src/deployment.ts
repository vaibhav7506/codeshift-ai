export type DeploymentEnvironment = "development" | "test" | "staging" | "production";

export interface RuntimeConfiguration {
  environment: DeploymentEnvironment;
  publicBaseUrl: string;
  databaseUrl?: string;
  encryptionKey?: string;
  identitySecret?: string;
  githubWebhookSecret?: string;
  logRetentionDays: number;
  auditRetentionDays: number;
  objectStorageLifecycleDays: number;
}

export function validateRuntimeConfiguration(
  input: Partial<RuntimeConfiguration>,
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const environment = input.environment;
  if (!environment || !["development", "test", "staging", "production"].includes(environment)) {
    errors.push("A supported deployment environment is required.");
  }
  if (!isHttpsUrl(input.publicBaseUrl, environment !== "development" && environment !== "test")) {
    errors.push("publicBaseUrl must be a valid URL and HTTPS outside development/test.");
  }
  for (const [name, value] of [
    ["logRetentionDays", input.logRetentionDays],
    ["auditRetentionDays", input.auditRetentionDays],
    ["objectStorageLifecycleDays", input.objectStorageLifecycleDays],
  ] as const) {
    if (!Number.isInteger(value) || (value ?? 0) < 1) errors.push(`${name} must be a positive integer.`);
  }
  if (environment === "production" || environment === "staging") {
    if (!isSecureDatabaseUrl(input.databaseUrl)) errors.push("A TLS databaseUrl is required.");
    if (!input.encryptionKey || input.encryptionKey.length < 32) errors.push("encryptionKey must be at least 32 characters.");
    if (!input.identitySecret || input.identitySecret.length < 32) errors.push("identitySecret must be at least 32 characters.");
    if (!input.githubWebhookSecret || input.githubWebhookSecret.length < 32) errors.push("githubWebhookSecret must be at least 32 characters.");
  } else if (!input.databaseUrl) {
    warnings.push("Using in-memory adapters; state will not survive restart.");
  }
  return { valid: errors.length === 0, errors, warnings };
}

export interface SchemaMigration {
  id: string;
  checksum: string;
  apply(transaction: unknown): Promise<void>;
  rollback(transaction: unknown): Promise<void>;
}

export function validateMigrationSequence(migrations: readonly SchemaMigration[]): void {
  const ids = new Set<string>();
  for (const migration of migrations) {
    if (!/^\d{4}_[a-z0-9_]+$/.test(migration.id)) throw new Error(`Invalid migration id ${migration.id}.`);
    if (ids.has(migration.id)) throw new Error(`Duplicate migration ${migration.id}.`);
    if (!/^[a-f0-9]{64}$/i.test(migration.checksum)) throw new Error(`Invalid checksum for ${migration.id}.`);
    ids.add(migration.id);
  }
  const sorted = [...ids].sort();
  if ([...ids].some((id, index) => id !== sorted[index])) throw new Error("Migrations must be ordered.");
}

function isHttpsUrl(value: unknown, requireHttps: boolean): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return requireHttps ? url.protocol === "https:" : ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function isSecureDatabaseUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) &&
      (url.searchParams.get("sslmode") === "require" || url.searchParams.get("sslmode") === "verify-full");
  } catch {
    return false;
  }
}
