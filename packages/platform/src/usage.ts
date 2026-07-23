export type UsageMetric =
  | "ANALYSED_REPOSITORIES"
  | "REPOSITORY_BYTES"
  | "CAMPAIGNS"
  | "RUNNER_MINUTES"
  | "AI_INPUT_TOKENS"
  | "AI_OUTPUT_TOKENS"
  | "AI_COST_MICRO_USD"
  | "STORAGE_BYTES"
  | "VALIDATION_SECONDS"
  | "CHANGED_FILES"
  | "GENERATED_REPORTS";

export interface UsageEvent {
  organizationId: string;
  workspaceId: string;
  metric: UsageMetric;
  quantity: number;
  timestamp: string;
  correlationId: string;
}

export interface EntitlementPlan {
  id: string;
  name: string;
  limits: Partial<Record<UsageMetric, number>>;
  features: string[];
}

export class UsageMeter {
  readonly #events: UsageEvent[] = [];

  record(event: UsageEvent): void {
    if (!Number.isFinite(event.quantity) || event.quantity < 0) {
      throw new Error("Usage quantity must be a non-negative finite number.");
    }
    this.#events.push(structuredClone(event));
  }

  total(organizationId: string, workspaceId: string, metric: UsageMetric): number {
    return this.#events
      .filter((event) =>
        event.organizationId === organizationId &&
        event.workspaceId === workspaceId &&
        event.metric === metric)
      .reduce((sum, event) => sum + event.quantity, 0);
  }

  enforce(
    organizationId: string,
    workspaceId: string,
    metric: UsageMetric,
    additionalQuantity: number,
    plan: EntitlementPlan,
  ): void {
    const limit = plan.limits[metric];
    if (
      limit !== undefined &&
      this.total(organizationId, workspaceId, metric) + additionalQuantity > limit
    ) {
      throw new Error(`Usage limit ${metric} would be exceeded.`);
    }
  }

  export(organizationId: string, workspaceId: string): UsageEvent[] {
    return this.#events
      .filter((event) =>
        event.organizationId === organizationId &&
        event.workspaceId === workspaceId)
      .map((event) => structuredClone(event));
  }
}

export interface BillingProvider {
  createInvoice(input: {
    organizationId: string;
    periodStart: string;
    periodEnd: string;
    usage: UsageEvent[];
  }): Promise<{ externalInvoiceId: string }>;
}

export const personalPlan: EntitlementPlan = {
  id: "personal",
  name: "Personal",
  limits: {
    ANALYSED_REPOSITORIES: 25,
    CAMPAIGNS: 20,
    RUNNER_MINUTES: 1_000,
    AI_INPUT_TOKENS: 2_000_000,
    STORAGE_BYTES: 5 * 1024 * 1024 * 1024,
  },
  features: ["personal-workspace", "local-runner", "byok"],
};
