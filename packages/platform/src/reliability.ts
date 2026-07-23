export interface RetryPolicy {
  maximumAttempts: number;
  initialDelayMs: number;
  maximumDelayMs: number;
  multiplier: number;
}

export async function retryWithBackoff<T>(
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  wait: (milliseconds: number) => Promise<void> = delay,
): Promise<T> {
  if (policy.maximumAttempts < 1) throw new Error("Retry policy requires at least one attempt.");
  let lastError: unknown;
  for (let attempt = 1; attempt <= policy.maximumAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < policy.maximumAttempts) {
        const duration = Math.min(
          policy.maximumDelayMs,
          policy.initialDelayMs * policy.multiplier ** (attempt - 1),
        );
        await wait(duration);
      }
    }
  }
  throw lastError;
}

export class CircuitBreaker {
  #failures = 0;
  #openedAt?: number;

  constructor(
    private readonly failureThreshold: number,
    private readonly resetAfterMs: number,
    private readonly clock: () => number = Date.now,
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#openedAt !== undefined && this.clock() - this.#openedAt < this.resetAfterMs) {
      throw new Error("External provider circuit is open.");
    }
    if (this.#openedAt !== undefined) {
      this.#openedAt = undefined;
      this.#failures = 0;
    }
    try {
      const result = await operation();
      this.#failures = 0;
      return result;
    } catch (error) {
      this.#failures += 1;
      if (this.#failures >= this.failureThreshold) this.#openedAt = this.clock();
      throw error;
    }
  }

  status(): "CLOSED" | "OPEN" {
    return this.#openedAt === undefined ? "CLOSED" : "OPEN";
  }
}

export class ConcurrencyGate {
  #active = 0;
  #queued = 0;

  constructor(
    private readonly maximumConcurrency: number,
    private readonly maximumQueueDepth: number,
  ) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#active >= this.maximumConcurrency) {
      if (this.#queued >= this.maximumQueueDepth) throw new Error("Queue backpressure limit reached.");
      this.#queued += 1;
      try {
        await this.waitForCapacity();
      } finally {
        this.#queued -= 1;
      }
    }
    this.#active += 1;
    try {
      return await operation();
    } finally {
      this.#active -= 1;
    }
  }

  usage(): { active: number; queued: number } {
    return { active: this.#active, queued: this.#queued };
  }

  private async waitForCapacity(): Promise<void> {
    while (this.#active >= this.maximumConcurrency) {
      await delay(5);
    }
  }
}

export interface Transaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface ConnectionPool<TConnection> {
  readonly maximumSize: number;
  acquire(signal?: AbortSignal): Promise<TConnection>;
  release(connection: TConnection): Promise<void>;
  close(): Promise<void>;
  health(): Promise<{ available: number; active: number; waiting: number }>;
}

export async function withTransaction<T>(
  begin: () => Promise<Transaction>,
  operation: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  const transaction = await begin();
  try {
    const result = await operation(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export class GracefulShutdown {
  readonly #handlers: Array<() => Promise<void>> = [];
  #shuttingDown = false;

  register(handler: () => Promise<void>): void {
    this.#handlers.push(handler);
  }

  async run(): Promise<void> {
    if (this.#shuttingDown) return;
    this.#shuttingDown = true;
    await Promise.allSettled(this.#handlers.map((handler) => handler()));
  }

  get isShuttingDown(): boolean {
    return this.#shuttingDown;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
