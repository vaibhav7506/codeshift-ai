import {
  generateMigrationPlan,
  MigrationPlanInputError,
} from "@codeshift/migrator";
import type {
  AnalysisRiskLevel,
  PackageManager,
  RecommendedScope,
  RepositoryAnalysis,
} from "@codeshift/shared";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface GeneratePlanRequest {
  analysis: RepositoryAnalysis;
  selectedScope?: string;
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!isGeneratePlanRequest(body)) {
      return errorResponse(
        "INVALID_PLAN_REQUEST",
        "Provide a valid repository analysis and optional scope.",
        400,
      );
    }

    const plan = generateMigrationPlan({
      analysis: body.analysis,
      selectedScope: body.selectedScope,
    });

    return NextResponse.json({ plan });
  } catch (error) {
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
    value.selectedScope === undefined ||
    (typeof value.selectedScope === "string" &&
      value.selectedScope.length <= 300)
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
