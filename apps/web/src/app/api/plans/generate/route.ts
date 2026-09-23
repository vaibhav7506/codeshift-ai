import { MigrationPlanInputError } from "@codeshift/migrator";
import {
  createDefaultRecipeRegistry,
  createMigrationCampaign,
  transitionCampaign,
} from "@codeshift/platform/runtime";
import { getRecipeCatalogEntry } from "@codeshift/platform/recipe-catalog-runtime";
import { randomUUID } from "node:crypto";
import type {
  AnalysisRiskLevel,
  PackageManager,
  RecommendedScope,
  RepositoryAnalysis,
} from "@codeshift/shared";
import { NextResponse } from "next/server";
import {
  apiError,
  assertMutationSecurity,
  requireApiPermission,
} from "@/lib/enterprise-api";
import { saveCampaign } from "@/lib/campaign-store";

export const runtime = "nodejs";

interface GeneratePlanRequest {
  analysis: RepositoryAnalysis;
  selectedScope: string;
  recipeId: string;
  recipeVersion: string;
  recipeConfiguration?: Record<string, string | number | boolean | string[]>;
}

export async function POST(request: Request) {
  try {
    assertMutationSecurity(request);
    const context = requireApiPermission(request, "CAMPAIGN_MANAGE");
    const body: unknown = await request.json();

    if (!isGeneratePlanRequest(body)) {
      return errorResponse(
        "INVALID_PLAN_REQUEST",
        "Provide a valid repository analysis, scope, and selected recipe.",
        400,
      );
    }

    const catalogRecipe = getRecipeCatalogEntry(body.recipeId);
    if (
      !catalogRecipe ||
      catalogRecipe.version !== body.recipeVersion ||
      catalogRecipe.status !== "active"
    ) {
      return errorResponse(
        "RECIPE_NOT_EXECUTABLE",
        "The selected recipe is not enabled for execution.",
        422,
      );
    }
    const recipe = createDefaultRecipeRegistry().get(body.recipeId, body.recipeVersion);
    const plan = await recipe.plan({
      repositoryId: body.analysis.repoUrl,
      analysis: body.analysis,
      files: [],
      approvedScope: body.selectedScope,
    });
    const campaignId = `campaign-${randomUUID()}`;
    const created = createMigrationCampaign({
      id: campaignId,
      organizationId: context.organizationId,
      workspaceId: context.workspaceId,
      repositoryId: body.analysis.repoUrl,
      name: `${body.analysis.repo} · ${catalogRecipe.name}`,
      selectedRecipes: [{ id: body.recipeId, version: body.recipeVersion }],
      recipeId: body.recipeId,
      recipeVersion: body.recipeVersion,
      recipeConfiguration: body.recipeConfiguration,
      targetTechnology: catalogRecipe.targetTechnology,
      approvedScope: { paths: [body.selectedScope], protectedPaths: [".github/**"] },
      riskScore: plan.estimatedRisk === "HIGH" ? 75 : plan.estimatedRisk === "MEDIUM" ? 50 : 25,
      estimatedAffectedFiles: plan.affectedFilesEstimate,
      validationRequirements: [...catalogRecipe.validationRequirements],
    });
    const analysing = transitionCampaign(created, "ANALYSING");
    const ready = transitionCampaign(analysing, "READY_FOR_REVIEW");
    saveCampaign({
      campaign: ready,
      repository: body.analysis.repoUrl,
      targetBranch: `codeshift-ai/${body.recipeId}-${campaignId.slice(-8)}`,
      runnerStatus: "No runner connected",
      authorId: context.userId,
      approvalStageStatus: "PENDING",
    });

    return NextResponse.json({
      plan,
      campaignId,
      recipe: { id: catalogRecipe.id, name: catalogRecipe.name, version: catalogRecipe.version },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "FORBIDDEN") {
      return apiError(error);
    }
    if (error instanceof MigrationPlanInputError) {
      return errorResponse(
        error.code,
        error.message,
        error.code === "SCOPE_REQUIRED" ? 422 : 400,
      );
    }

    if (error instanceof SyntaxError) {
      return errorResponse(
        "INVALID_REQUEST",
        "The plan request body is not valid JSON.",
        400,
      );
    }

    console.error("Migration plan generation failed", error);
    return errorResponse(
      "PLAN_GENERATION_FAILED",
      "The migration plan could not be generated.",
      500,
    );
  }
}

function isGeneratePlanRequest(value: unknown): value is GeneratePlanRequest {
  if (!isRecord(value) || !isRepositoryAnalysis(value.analysis)) {
    return false;
  }

  return (
    typeof value.selectedScope === "string" &&
    value.selectedScope.trim().length > 0 &&
    value.selectedScope.length <= 300 &&
    typeof value.recipeId === "string" &&
    /^[a-z0-9][a-z0-9-]{0,99}$/.test(value.recipeId) &&
    typeof value.recipeVersion === "string" &&
    value.recipeVersion.length > 0 &&
    value.recipeVersion.length <= 50 &&
    (value.recipeConfiguration === undefined ||
      (isRecord(value.recipeConfiguration) &&
        Object.keys(value.recipeConfiguration).length <= 30))
  );
}

function isRepositoryAnalysis(value: unknown): value is RepositoryAnalysis {
  if (!isRecord(value)) return false;

  const packageManagers: PackageManager[] = [
    "npm",
    "pnpm",
    "yarn",
    "unknown",
  ];
  const riskLevels: AnalysisRiskLevel[] = ["LOW", "MEDIUM", "HIGH"];
  const numericFields = [
    "totalFiles",
    "jsFiles",
    "tsFiles",
    "jsxFiles",
    "tsxFiles",
    "readinessScore",
  ] as const;
  const booleanFields = [
    "hasTsConfig",
    "hasTests",
    "hasBuildScript",
    "hasLintScript",
    "hasTypecheckScript",
  ] as const;

  return (
    typeof value.repoUrl === "string" &&
    value.repoUrl.length > 0 &&
    typeof value.owner === "string" &&
    typeof value.repo === "string" &&
    typeof value.defaultBranch === "string" &&
    packageManagers.includes(value.packageManager as PackageManager) &&
    riskLevels.includes(value.difficulty as AnalysisRiskLevel) &&
    numericFields.every(
      (field) =>
        typeof value[field] === "number" &&
        Number.isFinite(value[field]) &&
        value[field] >= 0,
    ) &&
    booleanFields.every((field) => typeof value[field] === "boolean") &&
    Array.isArray(value.recommendedScopes) &&
    value.recommendedScopes.every(isRecommendedScope) &&
    Array.isArray(value.riskFactors)
  );
}

function isRecommendedScope(value: unknown): value is RecommendedScope {
  return (
    isRecord(value) &&
    typeof value.path === "string" &&
    typeof value.reason === "string" &&
    typeof value.estimatedFiles === "number" &&
    Number.isFinite(value.estimatedFiles) &&
    value.estimatedFiles >= 0 &&
    (value.risk === "LOW" ||
      value.risk === "MEDIUM" ||
      value.risk === "HIGH")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}
