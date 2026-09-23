import {
  apiError,
  assertMutationSecurity,
  requireApiPermission,
  secureJson,
} from "@/lib/enterprise-api";
import { getCampaign } from "@/lib/campaign-store";
import { issueCampaignToken } from "@/lib/campaign-token";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    assertMutationSecurity(request);
    const context = requireApiPermission(request, "CAMPAIGN_MANAGE");
    const { campaignId } = await params;
    const stored = getCampaign(campaignId, context.workspaceId);
    if (!stored || stored.campaign.status !== "APPROVED") {
      throw new Error("Only an approved campaign can issue an execution token.");
    }
    return secureJson(issueCampaignToken(campaignId, context.workspaceId), 201);
  } catch (error) {
    return apiError(error);
  }
}
