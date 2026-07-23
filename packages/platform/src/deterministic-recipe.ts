import type {
  AnalysisRiskLevel,
  MigrationTarget,
} from "@codeshift/shared";
import type {
  DetectionResult,
  MigrationRecipe,
  RecipeFile,
  RecipeFileChange,
  RecipeMetadata,
  RepositoryContext,
  RiskAssessment,
} from "./recipe.js";

export interface FileTransformResult {
  code: string;
  warnings?: string[];
  reason: string;
  confidence?: number;
  risk?: RecipeFileChange["risk"];
  behaviourPotentiallyAffected?: string[];
  unsupportedAssumptions?: string[];
  additionalChanges?: Array<{
    path: string;
    code: string;
    reason: string;
  }>;
}

export interface DeterministicRecipeDefinition {
  metadata: RecipeMetadata;
  target: MigrationTarget;
  matches(file: RecipeFile): boolean;
  detect(context: RepositoryContext): DetectionResult;
  assess?(context: RepositoryContext): RiskAssessment;
  transformFile(
    file: RecipeFile,
    context: RepositoryContext,
  ): FileTransformResult | undefined;
}

export function createDeterministicRecipe(
  definition: DeterministicRecipeDefinition,
): MigrationRecipe {
  return {
    ...definition.metadata,

    async detect(context) {
      return definition.detect(context);
    },

    async assess(context) {
      return (
        definition.assess?.(context) ?? {
          level: context.analysis.difficulty,
          score: riskScore(context.analysis.difficulty),
          factors: context.analysis.riskFactors.map((factor) => factor.title),
        }
      );
    },

    async plan(context) {
      const matchingFiles = context.files.filter(
        (file) =>
          isInsideScope(file.path, context.approvedScope) &&
          definition.matches(file),
      );
      const assessment = await this.assess(context);
      return {
        id: `${definition.metadata.id}-${stableHash(
          `${context.repositoryId}:${context.approvedScope}:${definition.metadata.version}`,
        )}`,
        repoUrl: context.analysis.repoUrl,
        target: definition.target,
        selectedScope: context.approvedScope,
        estimatedRisk: toAnalysisRisk(assessment.level),
        affectedFilesEstimate: matchingFiles.length,
        validationCommands: [...definition.metadata.validationRequirements],
        steps: definition.metadata.steps.map((step) => ({
          id: step.id,
          title: step.description,
          description: `${step.kind} recipe step`,
          status: "PENDING",
        })),
        createdAt: new Date().toISOString(),
      };
    },

    async transform(context) {
      const fileChanges: RecipeFileChange[] = [];
      const warnings: string[] = [];

      for (const file of context.files) {
        if (
          !isInsideScope(file.path, context.approvedScope) ||
          !definition.matches(file) ||
          file.content === undefined
        ) {
          continue;
        }

        const result = definition.transformFile(file, context);
        if (!result) continue;
        warnings.push(...(result.warnings ?? []).map((warning) => `${file.path}: ${warning}`));

        if (result.code !== file.content) {
          fileChanges.push(
            buildFileChange(
              file.path,
              file.content,
              result.code,
              result,
              definition.metadata,
            ),
          );
        }

        for (const additional of result.additionalChanges ?? []) {
          fileChanges.push({
            path: additional.path,
            originalCode: "",
            updatedCode: additional.code,
            reason: additional.reason,
            confidence: result.confidence ?? 0.9,
            risk: result.risk ?? "LOW",
            behaviourPotentiallyAffected: result.behaviourPotentiallyAffected ?? [],
            testsPerformed: definition.metadata.validationRequirements,
            validationEvidence: [],
            unsupportedAssumptions: result.unsupportedAssumptions ?? [],
            rollbackAction: `Delete ${additional.path} and restore the stage checkpoint.`,
          });
        }
      }

      return {
        changedFiles: fileChanges.map((change) => change.path),
        warnings,
        artifacts: [],
        fileChanges,
      };
    },

    async validate(context) {
      const failures = context.results.filter((result) => result.status === "FAILED");
      return {
        passed: failures.length === 0,
        results: context.results,
        summary:
          failures.length === 0
            ? "All available validation contracts passed or were skipped."
            : `${failures.length} validation contract(s) failed.`,
      };
    },

    async explain(context) {
      return {
        summary: `${definition.metadata.name} planned ${context.plan.steps.length} bounded steps for ${context.plan.selectedScope}.`,
        limitations: [
          ...definition.metadata.knownLimitations,
          ...context.warnings,
        ],
      };
    },

    async rollback(context) {
      return {
        checkpointId: context.checkpointId,
        status: "READY",
        requiresApproval: true,
      };
    },
  };
}

function buildFileChange(
  path: string,
  originalCode: string,
  updatedCode: string,
  result: FileTransformResult,
  metadata: RecipeMetadata,
): RecipeFileChange {
  return {
    path,
    originalCode,
    updatedCode,
    reason: result.reason,
    confidence: result.confidence ?? 0.9,
    risk: result.risk ?? "LOW",
    behaviourPotentiallyAffected: result.behaviourPotentiallyAffected ?? [],
    testsPerformed: metadata.validationRequirements,
    validationEvidence: [],
    unsupportedAssumptions: result.unsupportedAssumptions ?? [],
    rollbackAction: `Restore ${path} from the stage checkpoint.`,
  };
}

function isInsideScope(path: string, scope: string): boolean {
  const normalizedPath = normalize(path);
  const normalizedScope = normalize(scope);
  return (
    normalizedScope === "." ||
    normalizedPath === normalizedScope ||
    normalizedPath.startsWith(`${normalizedScope}/`)
  );
}

function normalize(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/|\/+$/g, "") || ".";
}

function riskScore(level: AnalysisRiskLevel): number {
  if (level === "HIGH") return 75;
  if (level === "MEDIUM") return 50;
  return 25;
}

function toAnalysisRisk(
  level: RiskAssessment["level"],
): AnalysisRiskLevel {
  return level === "CRITICAL" ? "HIGH" : level;
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}
