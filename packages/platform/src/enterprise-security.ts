import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export interface AuditEvent {
  id: string;
  organizationId: string;
  workspaceId: string;
  actorId: string;
  action: string;
  resource: string;
  timestamp: string;
  requestId: string;
  sessionId?: string;
  result: "SUCCESS" | "FAILURE";
  failureReason?: string;
  previous?: Record<string, unknown>;
  next?: Record<string, unknown>;
  previousHash: string;
  hash: string;
}

export class AppendOnlyAuditLog {
  readonly #events: AuditEvent[] = [];

  append(input: Omit<AuditEvent, "previousHash" | "hash">): AuditEvent {
    const safe = sanitizeAuditInput(input);
    const previousHash = this.#events.at(-1)?.hash ?? "GENESIS";
    const hash = createHash("sha256")
      .update(JSON.stringify({ ...safe, previousHash }))
      .digest("hex");
    const event = Object.freeze({ ...safe, previousHash, hash }) as AuditEvent;
    this.#events.push(event);
    return structuredClone(event);
  }

  list(organizationId: string, workspaceId: string): AuditEvent[] {
    return this.#events
      .filter((event) =>
        event.organizationId === organizationId &&
        event.workspaceId === workspaceId)
      .map((event) => structuredClone(event));
  }

  verify(): boolean {
    let previousHash = "GENESIS";
    for (const event of this.#events) {
      const { hash, ...unsigned } = event;
      const expected = createHash("sha256").update(JSON.stringify(unsigned)).digest("hex");
      if (event.previousHash !== previousHash || expected !== hash) return false;
      previousHash = hash;
    }
    return true;
  }
}

interface EncryptedValue {
  algorithm: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
}

export interface AiCredentialRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  provider: string;
  model: string;
  enabled: boolean;
  sourceCodeConsent: boolean;
  retentionDays: number;
  encryptedKey: EncryptedValue;
  createdAt: string;
  rotatedAt?: string;
}

export interface AiUsageRecord {
  organizationId: string;
  workspaceId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  requestHash: string;
  createdAt: string;
}

export const defaultSessionSecurityPolicy = {
  cookie: { httpOnly: true, secure: true, sameSite: "strict" as const },
  maximumFailedAttempts: 5,
  lockoutMinutes: 15,
  corsOrigins: [] as string[],
  maximumJsonBytes: 32_768,
  maximumWebhookBytes: 1_048_576,
} as const;

export function createAiUsageRecord(input: Omit<AiUsageRecord, "requestHash" | "createdAt"> & {
  requestId: string;
}, now = new Date().toISOString()): AiUsageRecord {
  const { requestId, ...usage } = input;
  return {
    ...usage,
    requestHash: createHash("sha256").update(requestId).digest("hex"),
    createdAt: now,
  };
}

export class EncryptedAiCredentialVault {
  readonly #records = new Map<string, AiCredentialRecord>();
  readonly #key: Buffer;

  constructor(masterKey: Uint8Array) {
    if (masterKey.byteLength !== 32) throw new Error("Vault master key must be 32 bytes.");
    this.#key = Buffer.from(masterKey);
  }

  store(input: Omit<AiCredentialRecord, "encryptedKey" | "createdAt" | "enabled"> & { apiKey: string }, now = new Date().toISOString()): void {
    if (input.apiKey.length < 8) throw new Error("Credential validation failed.");
    const { apiKey, ...metadata } = input;
    this.#records.set(input.id, {
      ...metadata,
      enabled: true,
      createdAt: now,
      encryptedKey: encrypt(apiKey, this.#key),
    });
  }

  resolve(id: string, organizationId: string, workspaceId: string): string {
    const record = this.requireTenantRecord(id, organizationId, workspaceId);
    if (!record.enabled) throw new Error("Credential is disabled.");
    return decrypt(record.encryptedKey, this.#key);
  }

  describe(id: string, organizationId: string, workspaceId: string): Omit<AiCredentialRecord, "encryptedKey"> & { key: string } {
    const record = this.requireTenantRecord(id, organizationId, workspaceId);
    return {
      id: record.id,
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      provider: record.provider,
      model: record.model,
      enabled: record.enabled,
      sourceCodeConsent: record.sourceCodeConsent,
      retentionDays: record.retentionDays,
      createdAt: record.createdAt,
      ...(record.rotatedAt ? { rotatedAt: record.rotatedAt } : {}),
      key: "••••••••",
    };
  }

  rotate(id: string, organizationId: string, workspaceId: string, apiKey: string, now = new Date().toISOString()): void {
    const record = this.requireTenantRecord(id, organizationId, workspaceId);
    if (apiKey.length < 8) throw new Error("Credential validation failed.");
    this.#records.set(id, { ...record, encryptedKey: encrypt(apiKey, this.#key), rotatedAt: now });
  }

  disable(id: string, organizationId: string, workspaceId: string): void {
    const record = this.requireTenantRecord(id, organizationId, workspaceId);
    this.#records.set(id, { ...record, enabled: false });
  }

  private requireTenantRecord(id: string, organizationId: string, workspaceId: string): AiCredentialRecord {
    const record = this.#records.get(id);
    if (!record || record.organizationId !== organizationId || record.workspaceId !== workspaceId) {
      throw new Error("Credential was not found in the active tenant.");
    }
    return record;
  }
}

export class SlidingWindowRateLimiter {
  readonly #requests = new Map<string, number[]>();

  constructor(
    private readonly maximum: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const active = (this.#requests.get(key) ?? []).filter((time) => time > now - this.windowMs);
    if (active.length >= this.maximum) {
      this.#requests.set(key, active);
      return false;
    }
    active.push(now);
    this.#requests.set(key, active);
    return true;
  }
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  const supplied = Buffer.from(signature);
  const calculated = Buffer.from(expected);
  return supplied.length === calculated.length && timingSafeEqual(supplied, calculated);
}

export function assertSafeRepositoryUrl(value: string, allowedHosts: string[]): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || !allowedHosts.includes(url.hostname.toLowerCase())) {
    throw new Error("Repository URL is not permitted.");
  }
  if (url.username || url.password || isPrivateHost(url.hostname)) {
    throw new Error("Repository URL could expose credentials or internal services.");
  }
  return url;
}

export const secureResponseHeaders = {
  "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'; object-src 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

function sanitizeAuditInput<T extends Omit<AuditEvent, "previousHash" | "hash">>(input: T): T {
  const serialized = JSON.stringify(input, (key, value: unknown) => {
    if (/secret|token|password|api.?key|source|content|diff/i.test(key)) return "[REDACTED]";
    return value;
  });
  return JSON.parse(serialized) as T;
}

function encrypt(value: string, key: Buffer): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decrypt(value: EncryptedValue, key: Buffer): string {
  const decipher = createDecipheriv(value.algorithm, key, Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function isPrivateHost(hostname: string): boolean {
  return hostname === "localhost" ||
    hostname === "::1" ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    /^169\.254\./.test(hostname);
}
