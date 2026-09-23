import { createMigrationCampaign } from "@codeshift/platform/campaign-runtime";
import { getRecipeCatalogEntry } from "@codeshift/platform/recipe-catalog-runtime";
import { NextResponse } from "next/server";
import {
  apiError,
  assertMutationSecurity,
  requireApiPermission,
} from "@/lib/enterprise-api";
import { saveCampaign } from "@/lib/campaign-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertMutationSecurity(request);
    const context = requireApiPermission(request, "CAMPAIGN_MANAGE");
    const body: unknown = await request.json();
    if (!isCampaignRequest(body)) {
      return errorResponse(
        "INVALID_CAMPAIGN_REQUEST",
        "Provide a repository, campaign name, approved scope, and selected recipe.",
        400,
      );
    }
    const selectedRecipe = body.selectedRecipes[0];
    const registeredRecipe = getRecipeCatalogEntry(selectedRecipe.id);
    if (
      !registeredRecipe ||
      registeredRecipe.version !== selectedRecipe.version ||
      registeredRecipe.status !== "active" ||
      !registeredRecipe.supportsTransformation
    ) {
      return errorResponse(
        "RECIPE_NOT_EXECUTABLE",
        "Select an enabled recipe with detection, planning, transformation, and validation support.",
        422,
      );
    }

    const campaign = createMigrationCampaign({
      id: body.id,
      organizationId: context.organizationId,
      workspaceId: context.workspaceId,
      repositoryId: body.repositoryId,
      name: body.name,
      selectedRecipes: body.selectedRecipes,
      recipeId: selectedRecipe.id,
      recipeVersion: selectedRecipe.version,
      recipeConfiguration: body.recipeConfiguration,
      targetTechnology: registeredRecipe.targetTechnology,
      targetVersion: body.targetVersion,
      approvedScope: {
        paths: body.paths,
        protectedPaths: body.protectedPaths ?? [],
      },
      riskScore: body.riskScore,
      estimatedAffectedFiles: body.estimatedAffectedFiles,
      validationRequirements: body.validationRequirements,
    });
    saveCampaign({
      campaign,
      repository: body.repositoryId,
      targetBranch: `codeshift-ai/${body.id}`,
      runnerStatus: "No runner connected",
      authorId: context.userId,
      approvalStageStatus: "PENDING",
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "FORBIDDEN") {
      return apiError(error);
    }
    if (error instanceof SyntaxError) {
      return errorResponse("INVALID_REQUEST", "The request body is not valid JSON.", 400);
    }
    console.error("Campaign creation failed", error);
    return errorResponse(
      "CAMPAIGN_CREATION_FAILED",
      "The migration campaign could not be created.",
      500,
    );
  }
}

interface CampaignRequest {
  id: string;
  repositoryId: string;
  name: string;
  selectedRecipes: Array<{ id: string; version: string }>;
  paths: string[];
  protectedPaths?: string[];
  riskScore: number;
  estimatedAffectedFiles: number;
  validationRequirements: string[];
  recipeConfiguration?: Record<string, string | number | boolean | string[]>;
  targetVersion?: string;
}

function isCampaignRequest(value: unknown): value is CampaignRequest {
  if (!isRecord(value)) return false;
  return (
    isBoundedString(value.id, 100) &&
    isBoundedString(value.repositoryId, 200) &&
    isBoundedString(value.name, 100) &&
    isRecipeList(value.selectedRecipes) &&
    isStringList(value.paths, 100) &&
    (value.protectedPaths === undefined || isStringList(value.protectedPaths, 100)) &&
    typeof value.riskScore === "number" &&
    value.riskScore >= 0 &&
    value.riskScore <= 100 &&
    typeof value.estimatedAffectedFiles === "number" &&
    value.estimatedAffectedFiles >= 0 &&
    isStringList(value.validationRequirements, 50)
    && (value.recipeConfiguration === undefined ||
      isRecipeConfiguration(value.recipeConfiguration))
    && (value.targetVersion === undefined ||
      isBoundedString(value.targetVersion, 100))
  );
}

function isRecipeConfiguration(
  value: unknown,
): value is Record<string, string | number | boolean | string[]> {
  if (!isRecord(value) || Object.keys(value).length > 30) return false;
  return Object.entries(value).every(
    ([key, entry]) =>
      /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key) &&
      (typeof entry === "boolean" ||
        (typeof entry === "number" && Number.isFinite(entry)) ||
        isBoundedString(entry, 300) ||
        (Array.isArray(entry) &&
          entry.length <= 50 &&
          entry.every((item) => isBoundedString(item, 300)))),
  );
}

function isRecipeList(value: unknown): value is Array<{ id: string; version: string }> {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 20 &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        isBoundedString(entry.id, 100) &&
        isBoundedString(entry.version, 50),
    )
  );
}

function isStringList(value: unknown, maximum: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= maximum &&
    value.every((entry) => isBoundedString(entry, 300))
  );
}

function isBoundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}
