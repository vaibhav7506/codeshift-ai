import {
  createMigrationCampaign,
  transitionCampaign,
  type MigrationCampaign,
} from "@codeshift/platform/campaign-runtime";
import type { ApprovalRequest } from "@codeshift/platform/enterprise-runtime";
import {
  recalculateApprovalRequest,
  toApprovalPolicy,
  type WorkspaceApprovalPolicy,
} from "@codeshift/platform/enterprise-runtime";
import { demoCampaign, dotNetDemoCampaign } from "@/lib/platform-demo";

export interface StoredCampaign {
  campaign: MigrationCampaign;
  repository: string;
  targetBranch: string;
  runnerStatus: string;
  authorId: string;
  approvalId?: string;
  approvalRequest?: ApprovalRequest;
  approvalStageStatus?: "PENDING" | "COMPLETED";
  executionEvents?: Array<{
    idempotencyKey: string;
    type: string;
    correlationId: string;
    occurredAt: string;
    payload: Record<string, string | number | boolean>;
  }>;
  audit: Array<{
    type: string;
    actorId: string;
    occurredAt: string;
    correlationId: string;
  }>;
}

const globalCampaignStore = globalThis as typeof globalThis & {
  __codeshiftCampaigns?: Map<string, StoredCampaign>;
};

const campaigns =
  globalCampaignStore.__codeshiftCampaigns ??
  (globalCampaignStore.__codeshiftCampaigns = new Map<string, StoredCampaign>());

export function saveCampaign(
  record: Omit<StoredCampaign, "audit"> & { audit?: StoredCampaign["audit"] },
): StoredCampaign {
  const stored = structuredClone({ ...record, audit: record.audit ?? [] });
  campaigns.set(campaignKey(stored.campaign.workspaceId, stored.campaign.id), stored);
  return structuredClone(stored);
}

export function getCampaign(
  campaignId: string,
  workspaceId: string,
): StoredCampaign | undefined {
  let record = campaigns.get(campaignKey(workspaceId, campaignId));
  if (!record) {
    record = seedDemoCampaign(campaignId, workspaceId);
  }
  return record ? structuredClone(record) : undefined;
}

export function approveCampaign(input: {
  campaignId: string;
  workspaceId: string;
  actorId: string;
  approvalId: string;
  correlationId: string;
  now?: string;
}): StoredCampaign {
  const key = campaignKey(input.workspaceId, input.campaignId);
  const record = campaigns.get(key);
  if (!record) throw new Error(`Campaign ${input.campaignId} was not found.`);
  if (record.approvalId || record.campaign.status === "APPROVED") {
    throw new Error("This campaign has already been approved.");
  }
  if (
    record.campaign.status !== "READY_FOR_REVIEW" &&
    record.campaign.status !== "AWAITING_APPROVAL"
  ) {
    throw new Error("Only a reviewed campaign can be approved.");
  }
  const now = input.now ?? new Date().toISOString();
  const awaiting = record.campaign.status === "READY_FOR_REVIEW"
    ? transitionCampaign(record.campaign, "AWAITING_APPROVAL", now)
    : record.campaign;
  const approved = transitionCampaign(awaiting, "APPROVED", now);
  const updated: StoredCampaign = {
    ...record,
    campaign: approved,
    approvalId: input.approvalId,
    approvalStageStatus: "COMPLETED",
    audit: [
      ...record.audit,
      {
        type: "CAMPAIGN_APPROVED",
        actorId: input.actorId,
        occurredAt: now,
        correlationId: input.correlationId,
      },
    ],
  };
  campaigns.set(key, structuredClone(updated));
  return structuredClone(updated);
}

export function recalculateCampaignApprovals(input: {
  organizationId: string;
  workspaceId: string;
  policy: WorkspaceApprovalPolicy;
  actorId: string;
  correlationId: string;
  now?: string;
}): { checked: number; approvedCampaignIds: string[] } {
  const now = input.now ?? new Date().toISOString();
  const approvalPolicy = toApprovalPolicy(input.policy);
  const approvedCampaignIds: string[] = [];
  let checked = 0;
  for (const [key, record] of campaigns.entries()) {
    if (
      record.campaign.workspaceId !== input.workspaceId ||
      !record.approvalRequest
    ) {
      continue;
    }
    checked += 1;
    const approvalRequest = recalculateApprovalRequest(
      record.approvalRequest,
      approvalPolicy,
    );
    const auditEvent = {
      type: "CAMPAIGN_APPROVAL_RECALCULATED",
      actorId: input.actorId,
      occurredAt: now,
      correlationId: input.correlationId,
    };
    if (
      approvalRequest.status === "APPROVED" &&
      record.campaign.status !== "APPROVED"
    ) {
      const awaiting = record.campaign.status === "READY_FOR_REVIEW"
        ? transitionCampaign(record.campaign, "AWAITING_APPROVAL", now)
        : record.campaign;
      if (awaiting.status === "AWAITING_APPROVAL") {
        const approved = transitionCampaign(awaiting, "APPROVED", now);
        campaigns.set(key, structuredClone({
          ...record,
          campaign: approved,
          approvalRequest,
          approvalId: approvalRequest.id,
          approvalStageStatus: "COMPLETED",
          audit: [...record.audit, auditEvent],
        }));
        approvedCampaignIds.push(record.campaign.id);
      }
    } else {
      campaigns.set(key, structuredClone({
        ...record,
        approvalRequest,
        approvalStageStatus: approvalRequest.status === "APPROVED"
          ? "COMPLETED"
          : "PENDING",
        audit: [...record.audit, auditEvent],
      }));
    }
  }
  return { checked, approvedCampaignIds };
}

export function saveApprovalRequest(
  campaignId: string,
  workspaceId: string,
  approvalRequest: ApprovalRequest,
): StoredCampaign {
  const key = campaignKey(workspaceId, campaignId);
  const record = campaigns.get(key);
  if (!record) throw new Error(`Campaign ${campaignId} was not found.`);
  const updated = { ...record, approvalRequest };
  campaigns.set(key, structuredClone(updated));
  return structuredClone(updated);
}

export function appendCampaignEvent(
  campaignId: string,
  workspaceId: string,
  event: NonNullable<StoredCampaign["executionEvents"]>[number],
): { record: StoredCampaign; duplicate: boolean } {
  const key = campaignKey(workspaceId, campaignId);
  const record = campaigns.get(key);
  if (!record) throw new Error(`Campaign ${campaignId} was not found.`);
  const existing = record.executionEvents ?? [];
  if (existing.some((entry) => entry.idempotencyKey === event.idempotencyKey)) {
    return { record: structuredClone(record), duplicate: true };
  }
  const updated = { ...record, executionEvents: [...existing, event] };
  campaigns.set(key, structuredClone(updated));
  return { record: structuredClone(updated), duplicate: false };
}

export function campaignCount(): number {
  return campaigns.size;
}

function campaignKey(workspaceId: string, campaignId: string): string {
  return `${workspaceId}:${campaignId}`;
}

function seedDemoCampaign(
  campaignId: string,
  workspaceId: string,
): StoredCampaign | undefined {
  const demo =
    campaignId === demoCampaign.id
      ? { value: demoCampaign, recipeId: "js-to-ts" }
      : campaignId === dotNetDemoCampaign.id
        ? { value: dotNetDemoCampaign, recipeId: "dotnet-framework-modernization" }
        : undefined;
  if (!demo) return undefined;
  const created = createMigrationCampaign({
    id: demo.value.id,
    organizationId: "personal-organization",
    workspaceId,
    repositoryId: demo.value.repository,
    name: demo.value.name,
    selectedRecipes: [{ id: demo.recipeId, version: demo.value.version }],
    recipeId: demo.recipeId,
    recipeVersion: demo.value.version,
    approvedScope: {
      paths: [...demo.value.scope],
      protectedPaths: [...demo.value.protectedFiles],
    },
    riskScore: demo.value.riskScore,
    estimatedAffectedFiles: demo.value.affectedFiles,
    validationRequirements: [...demo.value.validations],
  });
  const ready = transitionCampaign(
    transitionCampaign(created, "ANALYSING"),
    "READY_FOR_REVIEW",
  );
  return saveCampaign({
    campaign: ready,
    repository: demo.value.repository,
    targetBranch: `codeshift-ai/${demo.recipeId}`,
    runnerStatus: demo.value.runnerStatus,
    authorId: "personal-user",
    approvalStageStatus: "PENDING",
    approvalRequest:
      campaignId === dotNetDemoCampaign.id && workspaceId.startsWith("personal-")
        ? {
            id: `approval-${campaignId}`,
            organizationId: ready.organizationId,
            workspaceId,
            authorId: "personal-user",
            riskScore: ready.riskScore,
            category: "STANDARD",
            validationPassed: true,
            approvals: [{
              userId: "personal-user",
              decidedAt: ready.updatedAt,
            }],
            status: "PENDING",
          }
        : undefined,
  });
}
