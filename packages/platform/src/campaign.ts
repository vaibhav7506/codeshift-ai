export type CampaignStatus =
  | "DRAFT"
  | "ANALYSING"
  | "READY_FOR_REVIEW"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "QUEUED"
  | "RUNNING"
  | "VALIDATION_FAILED"
  | "AWAITING_FINAL_APPROVAL"
  | "COMPLETED"
  | "PARTIALLY_COMPLETED"
  | "ROLLED_BACK"
  | "CANCELLED";

export interface ApprovedScope {
  paths: string[];
  protectedPaths: string[];
  approvedBy?: string;
  approvedAt?: string;
}

export interface CampaignStage {
  id: string;
  recipeId?: string;
  recipeVersion?: string;
  order: number;
  status: "PENDING" | "READY" | "RUNNING" | "COMPLETED" | "FAILED" | "ROLLED_BACK";
}

export interface CampaignDependency {
  stageId: string;
  dependsOnStageId: string;
}

export interface CampaignExecutionRecord {
  id: string;
  stageId: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  correlationId: string;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
}

export interface MigrationCampaign {
  id: string;
  organizationId: string;
  workspaceId: string;
  repositoryId: string;
  name: string;
  selectedRecipes: Array<{ id: string; version: string }>;
  recipeId?: string;
  recipeVersion?: string;
  recipeConfiguration?: Record<string, string | number | boolean | string[]>;
  targetTechnology?: string;
  targetVersion?: string;
  stages: CampaignStage[];
  dependencies: CampaignDependency[];
  approvedScope: ApprovedScope;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  estimatedAffectedFiles: number;
  validationRequirements: string[];
  status: CampaignStatus;
  executionHistory: CampaignExecutionRecord[];
  checkpointIds: string[];
  rollbackState: "AVAILABLE" | "IN_PROGRESS" | "COMPLETED" | "UNAVAILABLE";
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreateCampaignInput {
  id: string;
  organizationId: string;
  workspaceId: string;
  repositoryId: string;
  name: string;
  selectedRecipes: Array<{ id: string; version: string }>;
  recipeId?: string;
  recipeVersion?: string;
  recipeConfiguration?: Record<string, string | number | boolean | string[]>;
  targetTechnology?: string;
  targetVersion?: string;
  approvedScope: ApprovedScope;
  riskScore: number;
  estimatedAffectedFiles: number;
  validationRequirements: string[];
}

const TRANSITIONS: Readonly<Record<CampaignStatus, readonly CampaignStatus[]>> = {
  DRAFT: ["ANALYSING", "CANCELLED"],
  ANALYSING: ["READY_FOR_REVIEW", "CANCELLED"],
  READY_FOR_REVIEW: ["AWAITING_APPROVAL", "DRAFT", "CANCELLED"],
  AWAITING_APPROVAL: ["APPROVED", "READY_FOR_REVIEW", "CANCELLED"],
  APPROVED: ["QUEUED", "CANCELLED"],
  QUEUED: ["RUNNING", "CANCELLED"],
  RUNNING: [
    "VALIDATION_FAILED",
    "AWAITING_FINAL_APPROVAL",
    "PARTIALLY_COMPLETED",
    "CANCELLED",
  ],
  VALIDATION_FAILED: ["QUEUED", "ROLLED_BACK", "CANCELLED"],
  AWAITING_FINAL_APPROVAL: ["COMPLETED", "QUEUED", "ROLLED_BACK", "CANCELLED"],
  COMPLETED: ["ROLLED_BACK"],
  PARTIALLY_COMPLETED: ["QUEUED", "ROLLED_BACK", "CANCELLED"],
  ROLLED_BACK: [],
  CANCELLED: [],
};

export function createMigrationCampaign(
  input: CreateCampaignInput,
  now = new Date().toISOString(),
): MigrationCampaign {
  if (input.selectedRecipes.length === 0) {
    throw new Error("A campaign requires at least one recipe.");
  }
  const explicitRecipeId = input.recipeId ?? input.selectedRecipes[0]?.id;
  const explicitRecipeVersion =
    input.recipeVersion ?? input.selectedRecipes[0]?.version;
  if (!explicitRecipeId?.trim() || !explicitRecipeVersion?.trim()) {
    throw new Error("A campaign requires an explicit recipe.");
  }
  if (
    input.selectedRecipes[0]?.id !== explicitRecipeId ||
    input.selectedRecipes[0]?.version !== explicitRecipeVersion
  ) {
    throw new Error("The campaign recipe must match its first execution stage.");
  }
  if (input.approvedScope.paths.length === 0) {
    throw new Error("A campaign requires at least one approved path.");
  }
  if (input.riskScore < 0 || input.riskScore > 100) {
    throw new Error("Campaign risk score must be between 0 and 100.");
  }

  const stages = input.selectedRecipes.map((recipe, index): CampaignStage => ({
    id: `${input.id}-stage-${index + 1}`,
    recipeId: recipe.id,
    recipeVersion: recipe.version,
    order: index + 1,
    status: index === 0 ? "READY" : "PENDING",
  }));
  const dependencies = stages.slice(1).map((stage, index) => ({
    stageId: stage.id,
    dependsOnStageId: stages[index].id,
  }));

  return {
    ...input,
    recipeId: explicitRecipeId,
    recipeVersion: explicitRecipeVersion,
    stages,
    dependencies,
    riskLevel: riskLevelForScore(input.riskScore),
    status: "DRAFT",
    executionHistory: [],
    checkpointIds: [],
    rollbackState: "UNAVAILABLE",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

export function resolveCampaignRecipe(
  campaign: Pick<MigrationCampaign, "recipeId" | "recipeVersion" | "selectedRecipes">,
): { id: string; version: string; legacy: boolean } {
  if (campaign.recipeId && campaign.recipeVersion) {
    return {
      id: campaign.recipeId,
      version: campaign.recipeVersion,
      legacy: false,
    };
  }
  const selected = campaign.selectedRecipes[0];
  return {
    id: selected?.id ?? "js-to-ts",
    version: selected?.version ?? "1.0.0",
    legacy: true,
  };
}

export function transitionCampaign(
  campaign: MigrationCampaign,
  nextStatus: CampaignStatus,
  now = new Date().toISOString(),
): MigrationCampaign {
  if (!TRANSITIONS[campaign.status].includes(nextStatus)) {
    throw new Error(
      `Campaign cannot transition from ${campaign.status} to ${nextStatus}.`,
    );
  }

  return {
    ...campaign,
    status: nextStatus,
    updatedAt: now,
    version: campaign.version + 1,
  };
}

export interface CampaignRepository {
  create(campaign: MigrationCampaign): Promise<MigrationCampaign>;
  get(id: string, workspaceId: string): Promise<MigrationCampaign | undefined>;
  list(workspaceId: string): Promise<MigrationCampaign[]>;
  save(campaign: MigrationCampaign, expectedVersion: number): Promise<MigrationCampaign>;
}

export class InMemoryCampaignRepository implements CampaignRepository {
  private readonly campaigns = new Map<string, MigrationCampaign>();

  async create(campaign: MigrationCampaign): Promise<MigrationCampaign> {
    if (this.campaigns.has(campaign.id)) {
      throw new Error(`Campaign ${campaign.id} already exists.`);
    }
    this.campaigns.set(campaign.id, structuredClone(campaign));
    return structuredClone(campaign);
  }

  async get(
    id: string,
    workspaceId: string,
  ): Promise<MigrationCampaign | undefined> {
    const campaign = this.campaigns.get(id);
    return campaign?.workspaceId === workspaceId
      ? structuredClone(campaign)
      : undefined;
  }

  async list(workspaceId: string): Promise<MigrationCampaign[]> {
    return [...this.campaigns.values()]
      .filter((campaign) => campaign.workspaceId === workspaceId)
      .map((campaign) => structuredClone(campaign));
  }

  async save(
    campaign: MigrationCampaign,
    expectedVersion: number,
  ): Promise<MigrationCampaign> {
    const current = this.campaigns.get(campaign.id);
    if (!current || current.workspaceId !== campaign.workspaceId) {
      throw new Error(`Campaign ${campaign.id} was not found.`);
    }
    if (current.version !== expectedVersion) {
      throw new Error(`Campaign ${campaign.id} has been modified.`);
    }

    this.campaigns.set(campaign.id, structuredClone(campaign));
    return structuredClone(campaign);
  }
}

function riskLevelForScore(
  score: number,
): MigrationCampaign["riskLevel"] {
  if (score >= 85) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}
