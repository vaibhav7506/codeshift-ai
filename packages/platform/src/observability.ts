import { randomUUID } from "node:crypto";

export type TelemetryKind =
  | "HTTP_REQUEST"
  | "BACKGROUND_JOB"
  | "RUNNER_EXECUTION"
  | "RECIPE_STAGE"
  | "AI_REQUEST"
  | "VALIDATION_RUN"
  | "GIT_OPERATION"
  | "DATABASE_OPERATION"
  | "QUEUE";

export interface TelemetryEvent {
  timestamp: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  kind: TelemetryKind;
  name: string;
  correlationId: string;
  traceId?: string;
  organizationId?: string;
  workspaceId?: string;
  durationMs?: number;
  success?: boolean;
  attributes: Record<string, string | number | boolean>;
}

export interface TelemetrySink {
  emit(event: TelemetryEvent): void;
}

export interface ErrorTracker {
  capture(
    error: Error,
    context: {
      correlationId: string;
      traceId?: string;
      organizationId?: string;
      workspaceId?: string;
      operation: string;
    },
  ): void;
}

export class NoopErrorTracker implements ErrorTracker {
  capture(): void {}
}

export class InMemoryTelemetrySink implements TelemetrySink {
  readonly #events: TelemetryEvent[] = [];

  emit(event: TelemetryEvent): void {
    this.#events.push(structuredClone(sanitizeEvent(event)));
  }

  list(): TelemetryEvent[] {
    return this.#events.map((event) => structuredClone(event));
  }
}

export class JsonConsoleTelemetrySink implements TelemetrySink {
  emit(event: TelemetryEvent): void {
    const safe = sanitizeEvent(event);
    const output = JSON.stringify(safe);
    if (safe.level === "ERROR") console.error(output);
    else if (safe.level === "WARN") console.warn(output);
    else console.info(output);
  }
}

export class StructuredTelemetry {
  readonly #metrics = new Map<string, number>();

  constructor(
    private readonly sink: TelemetrySink,
    private readonly clock: () => number = Date.now,
  ) {}

  start(input: Omit<TelemetryEvent, "timestamp" | "durationMs" | "success" | "level" | "attributes"> & {
    attributes?: TelemetryEvent["attributes"];
  }): TelemetrySpan {
    return new TelemetrySpan(this, input, this.clock());
  }

  emit(event: TelemetryEvent): void {
    this.sink.emit(sanitizeEvent(event));
    this.increment(`${event.kind}.${event.name}.count`);
    if (event.success === false) this.increment(`${event.kind}.${event.name}.failures`);
    if (event.durationMs !== undefined) {
      this.#metrics.set(`${event.kind}.${event.name}.duration_ms`, event.durationMs);
    }
  }

  increment(name: string, amount = 1): void {
    this.#metrics.set(name, (this.#metrics.get(name) ?? 0) + amount);
  }

  gauge(name: string, value: number): void {
    this.#metrics.set(name, value);
  }

  metrics(): Record<string, number> {
    return Object.fromEntries(this.#metrics);
  }

  now(): number {
    return this.clock();
  }
}

export class TelemetrySpan {
  readonly correlationId: string;
  readonly traceId: string;
  #completed = false;

  constructor(
    private readonly telemetry: StructuredTelemetry,
    private readonly input: Omit<TelemetryEvent, "timestamp" | "durationMs" | "success" | "level" | "attributes"> & {
      attributes?: TelemetryEvent["attributes"];
    },
    private readonly startedAt: number,
  ) {
    this.correlationId = input.correlationId || randomUUID();
    this.traceId = input.traceId ?? randomUUID();
  }

  end(success: boolean, attributes: TelemetryEvent["attributes"] = {}): void {
    if (this.#completed) throw new Error("Telemetry span has already completed.");
    this.#completed = true;
    this.telemetry.emit({
      ...this.input,
      correlationId: this.correlationId,
      traceId: this.traceId,
      timestamp: new Date(this.telemetry.now()).toISOString(),
      level: success ? "INFO" : "ERROR",
      durationMs: Math.max(0, this.telemetry.now() - this.startedAt),
      success,
      attributes: { ...this.input.attributes, ...attributes },
    });
  }
}

export interface HealthCheck {
  name: string;
  critical: boolean;
  check(): Promise<{ healthy: boolean; detail?: string }>;
}

export async function evaluateHealth(
  checks: readonly HealthCheck[],
): Promise<{
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  checks: Array<{ name: string; healthy: boolean; critical: boolean; detail?: string }>;
}> {
  const results = await Promise.all(checks.map(async (check) => ({
    name: check.name,
    critical: check.critical,
    ...await check.check(),
  })));
  const status = results.some((result) => !result.healthy && result.critical)
    ? "UNHEALTHY"
    : results.some((result) => !result.healthy)
      ? "DEGRADED"
      : "HEALTHY";
  return { status, checks: results };
}

export const alertThresholds = {
  failureRatePercent: 5,
  queueLatencyMs: 30_000,
  p95ExecutionDurationMs: 20 * 60_000,
  runnerCpuPercent: 90,
  runnerMemoryPercent: 90,
} as const;

function sanitizeEvent(event: TelemetryEvent): TelemetryEvent {
  const serialized = JSON.stringify(event, (key, value: unknown) => {
    if (/source|code|content|diff|secret|token|password|api.?key/i.test(key)) {
      return "[REDACTED]";
    }
    return typeof value === "string" ? value.slice(0, 1_000) : value;
  });
  return JSON.parse(serialized) as TelemetryEvent;
}
