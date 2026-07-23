import { generateMigrationPlan } from "@codeshift/migrator/runtime";
import {
  migrateJavaScriptToTypeScript,
  type MigrationExecutionResult,
} from "@codeshift/migrator/migration-runtime";
import { JS_TO_TS_METADATA } from "./js-to-ts-metadata.js";
import type { MigrationRecipe } from "./recipe.js";

export { JS_TO_TS_METADATA } from "./js-to-ts-metadata.js";

export interface JavaScriptToTypeScriptRecipe extends MigrationRecipe {
  transform(
    context: Parameters<MigrationRecipe["transform"]>[0],
  ): Promise<
    Awaited<ReturnType<MigrationRecipe["transform"]>> & {
      execution: MigrationExecutionResult;
    }
  >;
}

export const javaScriptToTypeScriptRecipe: JavaScriptToTypeScriptRecipe = {
  ...JS_TO_TS_METADATA,

  async detect(context) {
    const count = context.analysis.jsFiles + context.analysis.jsxFiles;
    return {
      detected: count > 0,
      confidence: count > 0 ? 1 : 0,
      evidence: count > 0 ? [`${count} JavaScript/JSX files detected.`] : [],
    };
  },

  async assess(context) {
    const baseScore =
      context.analysis.difficulty === "HIGH"
        ? 75
        : context.analysis.difficulty === "MEDIUM"
          ? 50
          : 25;
    return {
      level: context.analysis.difficulty,
      score: baseScore,
      factors: context.analysis.riskFactors.map((factor) => factor.title),
    };
  },

  async plan(context) {
    return generateMigrationPlan({
      analysis: context.analysis,
      selectedScope: context.approvedScope,
    });
  },

  async transform(context) {
    const result = await migrateJavaScriptToTypeScript({
      rootDir: context.rootPath,
      selectedScope: context.approvedScope,
    });
    return {
      changedFiles: result.summary.changedFiles,
      warnings: result.summary.warnings,
      artifacts: [result.patchArtifactPath, result.summaryArtifactPath],
      execution: result,
    };
  },

  async validate(context) {
    const failed = context.results.filter((result) => result.status === "FAILED");
    return {
      passed: failed.length === 0,
      results: context.results,
      summary:
        failed.length === 0
          ? "All available validation contracts passed or were skipped."
          : `${failed.length} validation contract(s) failed.`,
    };
  },

  async explain(context) {
    return {
      summary: `${context.plan.steps.length} deterministic steps are scoped to ${context.plan.selectedScope}.`,
      limitations: [...JS_TO_TS_METADATA.knownLimitations, ...context.warnings],
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
