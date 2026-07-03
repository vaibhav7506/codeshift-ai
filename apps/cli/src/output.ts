import type { MigrationExecutionResult } from "@codeshift/migrator/migration-runtime";
import type {
  MigrationPlan,
  RecommendedScope,
  RepositoryAnalysis,
} from "@codeshift/shared";
import type { ValidationRunResult } from "./validation.js";
import type { AIEnhancementResult } from "./ai-enhancement.js";

const DIVIDER = "-".repeat(58);

export function formatAnalysisReport(
  analysis: RepositoryAnalysis,
  artifactPath: string,
): string {
  const scopes =
    analysis.recommendedScopes.length > 0
      ? analysis.recommendedScopes
          .map((scope, index) => formatScope(scope, index))
          .join("\n")
      : "  No safe starting scope was detected automatically.";

  return [
    "",
    "CodeShift AI",
    "Repository Analysis",
    DIVIDER,
    row("Repository", analysis.repo),
    row("Framework", titleCase(analysis.framework)),
    row("Package Manager", analysis.packageManager),
    row("Module System", titleCase(analysis.moduleSystem)),
    row("JavaScript Files", analysis.jsFiles),
    row("TypeScript Files", analysis.tsFiles),
    row("JSX / TSX Files", `${analysis.jsxFiles} / ${analysis.tsxFiles}`),
    row("Readiness Score", `${analysis.readinessScore}/100`),
    row("Difficulty", analysis.difficulty),
    "",
    "Recommended scopes:",
    scopes,
    "",
    "Artifacts written:",
    `  ${artifactPath}`,
    "",
  ].join("\n");
}

export function formatPlanReport(
  plan: MigrationPlan,
  artifactPath: string,
  analysisWasGenerated: boolean,
): string {
  const commands =
    plan.validationCommands.length > 0
      ? plan.validationCommands.map((command) => `  - ${command}`).join("\n")
      : "  No validation scripts detected.";

  return [
    "",
    "CodeShift AI",
    "Migration Plan",
    DIVIDER,
    row("Target", "JavaScript -> TypeScript"),
    row("Selected Scope", plan.selectedScope),
    row("Estimated Risk", plan.estimatedRisk),
    row("Affected Files", `~${plan.affectedFilesEstimate}`),
    row("Plan Steps", plan.steps.length),
    "",
    "Validation commands (not executed):",
    commands,
    "",
    "Artifacts written:",
    ...(analysisWasGenerated ? ["  .codeshift-ai/analysis.json"] : []),
    `  ${artifactPath}`,
    "",
    "No source files were modified.",
    "",
  ].join("\n");
}

export function formatMigrationReport(
  result: MigrationExecutionResult,
): string {
  const changedFiles =
    result.summary.changedFiles.length > 0
      ? result.summary.changedFiles.map((file) => `  - ${file}`).join("\n")
      : "  No files changed.";
  const warnings =
    result.summary.warnings.length > 0
      ? result.summary.warnings
          .map((warning) => `  - ${warning}`)
          .join("\n")
      : "  None.";

  return [
    "",
    "CodeShift AI",
    "JavaScript -> TypeScript Migration",
    DIVIDER,
    row("Selected Scope", result.summary.selectedScope),
    row("Changed Files", result.summary.changedFiles.length),
    row(
      "tsconfig.json",
      result.summary.tsconfigChanged ? "Created or updated" : "Unchanged",
    ),
    "",
    "Changed files:",
    changedFiles,
    "",
    "Warnings:",
    warnings,
    "",
    "Artifacts written:",
    `  ${result.patchArtifactPath}`,
    `  ${result.summaryArtifactPath}`,
    "",
    "Changes were not committed. Review the patch before continuing.",
    "",
  ].join("\n");
}

export function formatAIEnhancementReport(
  result: AIEnhancementResult,
): string {
  return [
    "AI review enhancement",
    DIVIDER,
    row("Provider", result.artifact.provider),
    row("Scope", result.artifact.selectedScope),
    "",
    `  ${result.artifact.patchExplanation.summary}`,
    "",
    row("PR summary title", result.artifact.prSummary.title),
    "",
    "Artifact written:",
    `  ${result.artifactPath}`,
    "",
    "No pull request was created.",
    "",
  ].join("\n");
}

export function formatValidationReport(result: ValidationRunResult): string {
  const passed = result.results.filter(
    (validation) => validation.status === "PASSED",
  ).length;
  const failed = result.results.filter(
    (validation) => validation.status === "FAILED",
  ).length;
  const skipped = result.results.filter(
    (validation) => validation.status === "SKIPPED",
  ).length;
  const commands = result.results
    .map((validation) => {
      const duration =
        validation.durationMs === undefined
          ? ""
          : ` (${validation.durationMs}ms)`;
      return `  ${validation.status.padEnd(8)} ${validation.command}${duration}`;
    })
    .join("\n");
  const warnings =
    result.warnings.length > 0
      ? ["", "Warnings:", ...result.warnings.map((warning) => `  - ${warning}`)]
      : [];

  return [
    "",
    "CodeShift AI",
    "Validation Runner",
    DIVIDER,
    row("Package Manager", result.packageManager),
    ...warnings,
    "",
    "Validation commands:",
    commands,
    "",
    row("Passed", passed),
    row("Failed", failed),
    row("Skipped", skipped),
    row("Overall", result.overallPassed ? "PASSED" : "FAILED"),
    "",
    "Artifacts written:",
    `  ${result.resultArtifactPath}`,
    `  ${result.logsArtifactPath}`,
    "",
  ].join("\n");
}

export function formatHelp(): string {
  return [
    "",
    "CodeShift AI",
    "Local repository analysis, migration, validation, and pull requests",
    "",
    "Usage:",
    "  codeshift-ai analyze",
    "  codeshift-ai plan --target js-to-ts --path <scope>",
    "  codeshift-ai migrate --target js-to-ts --path <scope>",
    "  codeshift-ai migrate --target js-to-ts --path <scope> --ai --provider openai",
    "  codeshift-ai validate",
    "  codeshift-ai pr",
    "",
    "Commands:",
    "  analyze   Analyze the repository in the current directory",
    "  plan      Generate a deterministic migration plan",
    "  migrate   Apply a scoped JavaScript to TypeScript migration",
    "  validate  Run available local validation scripts and save logs",
    "  pr        Review and create an explicitly approved GitHub pull request",
    "",
    "Options:",
    "  -h, --help       Show command help",
    "  -v, --version    Show CLI version",
    "",
  ].join("\n");
}

function formatScope(scope: RecommendedScope, index: number): string {
  return `  ${index + 1}. ${scope.path} - ${titleCase(scope.risk)} risk, ${scope.estimatedFiles} files`;
}

function row(label: string, value: string | number): string {
  return `  ${label.padEnd(20)} ${value}`;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
