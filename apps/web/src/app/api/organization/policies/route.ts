import { randomUUID } from "node:crypto";
import type { WorkspaceApprovalPolicy } from "@codeshift/platform/enterprise-runtime";
import {
  apiError,
  assertMutationSecurity,
  requireApiPermission,
  secureJson,
} from "@/lib/enterprise-api";
import { recalculateCampaignApprovals } from "@/lib/campaign-store";
import {
  appendWorkspacePolicyAudit,
  getWorkspaceApprovalPolicy,
  updateWorkspaceApprovalPolicy,
} from "@/lib/workspace-policy-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = requireApiPermission(request, "USAGE_READ");
    const policy = getWorkspaceApprovalPolicy(context);
    if (context.workspaceKind === "PERSONAL") {
      recalculateAndAudit(context, policy, randomUUID());
    }
    return secureJson({ policy });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertMutationSecurity(request);
    const context = requireApiPermission(request, "ORGANIZATION_MANAGE");
    const body: unknown = await request.json();
    if (!isWorkspaceApprovalPolicy(body)) {
      throw new Error("Provide all workspace policy values in the expected format.");
    }
    const correlationId = randomUUID();
    const policy = updateWorkspaceApprovalPolicy({
      ...context,
      actorId: context.userId,
      policy: body,
      correlationId,
    });
    const recalculation = recalculateAndAudit(
      context,
      policy,
      correlationId,
    );
    return secureJson({
      policy,
      recalculation,
      message: "Workspace policies saved.",
    });
  } catch (error) {
    return apiError(error);
  }
}

function recalculateAndAudit(
  context: ReturnType<typeof requireApiPermission>,
  policy: WorkspaceApprovalPolicy,
  correlationId: string,
) {
  const recalculation = recalculateCampaignApprovals({
    ...context,
    actorId: context.userId,
    policy,
    correlationId,
  });
  if (recalculation.checked > 0) {
    appendWorkspacePolicyAudit({
      organizationId: context.organizationId,
      workspaceId: context.workspaceId,
      actorId: context.userId,
      action: "CAMPAIGN_APPROVAL_RECALCULATED",
      resource: `workspace/${context.workspaceId}/campaigns`,
      timestamp: new Date().toISOString(),
      correlationId,
      next: {
        checkedCampaigns: recalculation.checked,
        approvedCampaignIds: recalculation.approvedCampaignIds,
      },
    });
  }
  return recalculation;
}

function isWorkspaceApprovalPolicy(
  value: unknown,
): value is WorkspaceApprovalPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  const expectedKeys = [
    "maximumRiskScore",
    "requiredApprovals",
    "highRiskApprovals",
    "authorCanApprove",
    "requireDistinctApprovers",
    "allowSourceCodeSharing",
  ];
  return Object.keys(body).length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(body, key)) &&
    typeof body.maximumRiskScore === "number" &&
    typeof body.requiredApprovals === "number" &&
    typeof body.highRiskApprovals === "number" &&
    typeof body.authorCanApprove === "boolean" &&
    typeof body.requireDistinctApprovers === "boolean" &&
    typeof body.allowSourceCodeSharing === "boolean";
}
