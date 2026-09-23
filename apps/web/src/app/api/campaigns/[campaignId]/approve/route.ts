import {
  approveRequest,
  recalculateApprovalRequest,
  toApprovalPolicy,
} from "@codeshift/platform/enterprise-runtime";
import { randomUUID } from "node:crypto";
import {
  apiError,
  assertMutationSecurity,
  requireApiPermission,
  secureJson,
} from "@/lib/enterprise-api";
import {
  approveCampaign,
  getCampaign,
  saveApprovalRequest,
  type StoredCampaign,
} from "@/lib/campaign-store";
import {
  appendWorkspacePolicyAudit,
  getWorkspaceApprovalPolicy,
} from "@/lib/workspace-policy-store";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    assertMutationSecurity(request);
    const context = requireApiPermission(request, "EXECUTION_APPROVE");
    const { campaignId } = await params;
    if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(campaignId)) {
      throw new Error("The campaign ID is invalid.");
    }
    const stored = getCampaign(campaignId, context.workspaceId);
    if (!stored) throw new Error("The campaign was not found in this workspace.");
    if (stored.approvalId || stored.campaign.status === "APPROVED") {
      return approvedResponse(campaignId, stored.campaign, stored.approvalRequest);
    }
    const workspacePolicy = getWorkspaceApprovalPolicy(context);
    if (stored.campaign.riskScore > workspacePolicy.maximumRiskScore) {
      throw new Error(
        `Campaign risk score ${stored.campaign.riskScore} exceeds the workspace maximum of ${workspacePolicy.maximumRiskScore}.`,
      );
    }
    const approvalPolicy = toApprovalPolicy(workspacePolicy);
    const existingApproval = recalculateApprovalRequest(
      stored.approvalRequest ?? {
        id: `approval-${randomUUID()}`,
        organizationId: context.organizationId,
        workspaceId: context.workspaceId,
        authorId: stored.authorId,
        riskScore: stored.campaign.riskScore,
        category: "STANDARD",
        validationPassed: true,
        approvals: [],
        status: "PENDING",
      },
      approvalPolicy,
    );
    if (existingApproval.status === "APPROVED") {
      saveApprovalRequest(campaignId, context.workspaceId, existingApproval);
      const correlationId = randomUUID();
      const approved = approveCampaign({
        campaignId,
        workspaceId: context.workspaceId,
        actorId: context.userId,
        approvalId: existingApproval.id,
        correlationId,
      });
      appendWorkspacePolicyAudit({
        organizationId: context.organizationId,
        workspaceId: context.workspaceId,
        actorId: context.userId,
        action: "CAMPAIGN_APPROVAL_RECALCULATED",
        resource: `campaign/${campaignId}`,
        timestamp: new Date().toISOString(),
        correlationId,
        next: { approvalCount: existingApproval.approvals.length, status: "APPROVED" },
      });
      return approvedResponse(campaignId, approved.campaign, existingApproval);
    }
    const approval = approveRequest(
      existingApproval,
      { userId: context.userId, roles: context.roles },
      approvalPolicy,
    );
    saveApprovalRequest(campaignId, context.workspaceId, approval);
    if (approval.status !== "APPROVED") {
      return secureJson({
        approval,
        readyForExecution: false,
        message: "Another approval is required before execution.",
      }, 202);
    }
    const approved = approveCampaign({
      campaignId,
      workspaceId: context.workspaceId,
      actorId: context.userId,
      approvalId: approval.id,
      correlationId: randomUUID(),
    });
    return approvedResponse(campaignId, approved.campaign, approval);
  } catch (error) {
    return apiError(error);
  }
}

function approvedResponse(
  campaignId: string,
  campaign: StoredCampaign["campaign"],
  approval?: StoredCampaign["approvalRequest"],
) {
  return secureJson({
    approval,
    campaign,
    readyForExecution: true,
    redirectTo: `/campaigns/${encodeURIComponent(campaignId)}/execute`,
    message: "Approval saved. The campaign is ready for execution.",
  });
}
