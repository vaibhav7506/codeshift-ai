import { getRecipeCatalogEntry } from "@codeshift/platform/recipe-catalog-runtime";
import { resolveCampaignRecipe } from "@codeshift/platform/campaign-runtime";
import { apiError, secureJson } from "@/lib/enterprise-api";
import { getCampaign } from "@/lib/campaign-store";
import { verifyCampaignToken } from "@/lib/campaign-token";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const payload = verifyCampaignToken(token, campaignId);
    const stored = getCampaign(campaignId, payload.workspaceId);
    if (!stored || stored.campaign.status !== "APPROVED") {
      throw new Error("The approved campaign was not found.");
    }
    const selected = resolveCampaignRecipe(stored.campaign);
    const recipe = getRecipeCatalogEntry(selected.id);
    if (!recipe || recipe.status !== "active") {
      throw new Error("The approved recipe is not executable.");
    }
    return secureJson({
      campaign: {
        id: stored.campaign.id,
        recipeId: selected.id,
        recipeVersion: selected.version,
        recipeConfiguration: stored.campaign.recipeConfiguration ?? {},
        approvedScope: stored.campaign.approvedScope,
        validationRequirements: stored.campaign.validationRequirements,
        targetBranch: stored.targetBranch,
        status: stored.campaign.status,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
