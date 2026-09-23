import type { ExecutionPlatform } from "@codeshift/shared";
import { apiError, requireApiPermission, secureJson } from "@/lib/enterprise-api";
import { getCampaign } from "@/lib/campaign-store";
import { buildExecutionGuide } from "@/lib/execution-guide";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const context = requireApiPermission(request, "USAGE_READ");
    const { campaignId } = await params;
    const requested = new URL(request.url).searchParams.get("platform");
    const platform: ExecutionPlatform =
      requested === "macos-linux" ? "macos-linux" : "windows-powershell";
    const stored = getCampaign(campaignId, context.workspaceId);
    if (!stored) throw new Error("The campaign was not found in this workspace.");
    if (stored.campaign.status !== "APPROVED") {
      throw new Error("The campaign must be approved before execution guidance is available.");
    }
    return secureJson({
      guide: buildExecutionGuide(stored, platform),
      campaign: {
        name: stored.campaign.name,
        repository: stored.repository,
        approvedScope: stored.campaign.approvedScope.paths,
        status: stored.campaign.status,
        targetBranch: stored.targetBranch,
        runnerStatus: stored.runnerStatus,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
