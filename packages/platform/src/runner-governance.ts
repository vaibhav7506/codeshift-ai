import { createHash, randomBytes } from "node:crypto";

export interface RunnerIsolationPolicy {
  cpuLimit: number;
  memoryMb: number;
  timeoutSeconds: number;
  network: "DENY" | "ALLOWLIST";
  allowedHosts: string[];
  readOnlyRoot: boolean;
  sanitizeLogs: boolean;
  cleanupAfterJob: boolean;
  persistRepository: false;
}

export const defaultRunnerIsolationPolicy: RunnerIsolationPolicy = {
  cpuLimit: 2,
  memoryMb: 4096,
  timeoutSeconds: 1800,
  network: "DENY",
  allowedHosts: [],
  readOnlyRoot: true,
  sanitizeLogs: true,
  cleanupAfterJob: true,
  persistRepository: false,
};

interface PairingToken {
  organizationId: string;
  workspaceId: string;
  hash: string;
  expiresAt: number;
  used: boolean;
}

export interface Runner {
  id: string;
  organizationId: string;
  workspaceId: string;
  identity: string;
  labels: string[];
  runtimes: string[];
  capacity: number;
  activeJobs: string[];
  status: "ONLINE" | "OFFLINE" | "REVOKED";
  version: string;
  lastHeartbeatAt: string;
  credentialExpiresAt: string;
}

export class RunnerRegistry {
  readonly #tokens = new Map<string, PairingToken>();
  readonly #runners = new Map<string, Runner>();
  readonly #credentialHashes = new Map<string, string>();

  createPairingToken(organizationId: string, workspaceId: string, now = Date.now()): string {
    const token = randomBytes(32).toString("base64url");
    this.#tokens.set(hash(token), {
      organizationId,
      workspaceId,
      hash: hash(token),
      expiresAt: now + 10 * 60_000,
      used: false,
    });
    return token;
  }

  register(
    token: string,
    input: Pick<Runner, "id" | "identity" | "labels" | "runtimes" | "capacity" | "version">,
    now = Date.now(),
  ): { runner: Runner; credential: string } {
    const tokenHash = hash(token);
    const pairing = this.#tokens.get(tokenHash);
    if (!pairing || pairing.used || pairing.expiresAt <= now) {
      throw new Error("Pairing token is invalid, expired, or already used.");
    }
    pairing.used = true;
    const credential = randomBytes(32).toString("base64url");
    const runner: Runner = {
      ...input,
      organizationId: pairing.organizationId,
      workspaceId: pairing.workspaceId,
      activeJobs: [],
      status: "ONLINE",
      lastHeartbeatAt: new Date(now).toISOString(),
      credentialExpiresAt: new Date(now + 60 * 60_000).toISOString(),
    };
    this.#runners.set(input.id, runner);
    this.#credentialHashes.set(input.id, hash(credential));
    return { runner: structuredClone(runner), credential };
  }

  heartbeat(
    id: string,
    organizationId: string,
    workspaceId: string,
    credential: string,
    now = Date.now(),
  ): Runner {
    const runner = this.requireTenantRunner(id, organizationId, workspaceId);
    if (runner.status === "REVOKED") throw new Error("Runner has been revoked.");
    if (
      this.#credentialHashes.get(id) !== hash(credential) ||
      Date.parse(runner.credentialExpiresAt) <= now
    ) {
      throw new Error("Runner credential is invalid or expired.");
    }
    const updated = { ...runner, status: "ONLINE" as const, lastHeartbeatAt: new Date(now).toISOString() };
    this.#runners.set(id, updated);
    return structuredClone(updated);
  }

  revoke(id: string, organizationId: string, workspaceId: string): Runner {
    const runner = this.requireTenantRunner(id, organizationId, workspaceId);
    const revoked = { ...runner, status: "REVOKED" as const };
    this.#runners.set(id, revoked);
    this.#credentialHashes.delete(id);
    return structuredClone(revoked);
  }

  private requireTenantRunner(id: string, organizationId: string, workspaceId: string): Runner {
    const runner = this.#runners.get(id);
    if (!runner || runner.organizationId !== organizationId || runner.workspaceId !== workspaceId) {
      throw new Error("Runner was not found in the active tenant.");
    }
    return runner;
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
