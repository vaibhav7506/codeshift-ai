export interface BackgroundJobOptions {
  id: string;
  organizationId: string;
  workspaceId: string;
  idempotencyKey: string;
  correlationId: string;
  timeoutMs: number;
  maxAttempts: number;
}

export interface BackgroundJobRecord<T = unknown> extends BackgroundJobOptions {
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  attempts: number;
  progress: number;
  logs: Array<{ level: "info" | "warn" | "error"; message: string }>;
  failureReason?: string;
  result?: T;
}

export interface JobContext {
  readonly correlationId: string;
  isCancelled(): boolean;
  reportProgress(progress: number): void;
  log(level: "info" | "warn" | "error", message: string): void;
}

export class InMemoryBackgroundJobQueue {
  private readonly jobs = new Map<string, BackgroundJobRecord>();
  private readonly idempotency = new Map<string, string>();
  private readonly cancellations = new Set<string>();
  private readonly deadLetterJobs: BackgroundJobRecord[] = [];

  constructor(
    private readonly maximumQueueDepth = 1_000,
    private readonly retryDelay: (attempt: number) => Promise<void> = async () => {},
  ) {}

  enqueue(options: BackgroundJobOptions): BackgroundJobRecord {
    const ownerKey = `${options.organizationId}:${options.workspaceId}:${options.idempotencyKey}`;
    const existingId = this.idempotency.get(ownerKey);
    if (existingId) return this.get(existingId);
    if (options.timeoutMs <= 0 || options.maxAttempts <= 0) {
      throw new Error("Jobs require a positive timeout and attempt limit.");
    }
    const queued = [...this.jobs.values()].filter((job) =>
      job.status === "QUEUED" || job.status === "RUNNING").length;
    if (queued >= this.maximumQueueDepth) throw new Error("Queue backpressure limit reached.");

    const record: BackgroundJobRecord = {
      ...options,
      status: "QUEUED",
      attempts: 0,
      progress: 0,
      logs: [],
    };
    this.jobs.set(options.id, record);
    this.idempotency.set(ownerKey, options.id);
    return structuredClone(record);
  }

  async run<T>(
    id: string,
    handler: (context: JobContext) => Promise<T>,
  ): Promise<BackgroundJobRecord<T>> {
    const record = this.require(id) as BackgroundJobRecord<T>;
    if (record.status === "SUCCEEDED" || record.status === "CANCELLED") {
      return structuredClone(record);
    }

    while (record.attempts < record.maxAttempts) {
      if (this.cancellations.has(id)) {
        record.status = "CANCELLED";
        return structuredClone(record);
      }

      record.status = "RUNNING";
      record.attempts += 1;
      try {
        const result = await withTimeout(
          handler({
            correlationId: record.correlationId,
            isCancelled: () => this.cancellations.has(id),
            reportProgress: (progress) => {
              record.progress = Math.min(100, Math.max(0, progress));
            },
            log: (level, message) => {
              record.logs.push({ level, message: sanitizeLog(message) });
            },
          }),
          record.timeoutMs,
        );
        record.result = result;
        record.status = "SUCCEEDED";
        record.progress = 100;
        return structuredClone(record);
      } catch (error) {
        record.failureReason =
          error instanceof Error ? sanitizeLog(error.message) : "Unknown job failure.";
        record.logs.push({ level: "error", message: record.failureReason });
        if (record.attempts < record.maxAttempts) await this.retryDelay(record.attempts);
      }
    }

    record.status = "FAILED";
    this.deadLetterJobs.push(structuredClone(record));
    return structuredClone(record);
  }

  cancel(id: string): BackgroundJobRecord {
    const record = this.require(id);
    this.cancellations.add(id);
    if (record.status === "QUEUED") record.status = "CANCELLED";
    return structuredClone(record);
  }

  get(id: string): BackgroundJobRecord {
    return structuredClone(this.require(id));
  }

  resume(id: string): BackgroundJobRecord {
    const record = this.require(id);
    if (record.status !== "FAILED" && record.status !== "CANCELLED") {
      throw new Error("Only failed or cancelled jobs can be resumed.");
    }
    this.cancellations.delete(id);
    record.status = "QUEUED";
    record.attempts = 0;
    record.failureReason = undefined;
    return structuredClone(record);
  }

  deadLetters(): BackgroundJobRecord[] {
    return this.deadLetterJobs.map((record) => structuredClone(record));
  }

  private require(id: string): BackgroundJobRecord {
    const record = this.jobs.get(id);
    if (!record) throw new Error(`Job ${id} was not found.`);
    return record;
  }
}

function sanitizeLog(message: string): string {
  return message
    .replace(
      /\b(api[_-]?key|token|secret|password)\s*[=:]\s*\S+/gi,
      "$1=[REDACTED]",
    )
    .slice(0, 2_000);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Job timed out.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
