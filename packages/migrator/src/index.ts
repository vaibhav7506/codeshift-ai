import type {
  AnalysisRiskLevel,
  MigrationPlan,
  MigrationStep,
  PackageManager,
  RepositoryAnalysis,
} from "@codeshift/shared";


export interface GenerateMigrationPlanInput {
  analysis: RepositoryAnalysis;
  selectedScope?: string;
}

export class MigrationPlanInputError extends Error {
  constructor(
    readonly code: "SCOPE_REQUIRED" | "INVALID_SCOPE",
    message: string,
  ) {
    super(message);
    this.name = "MigrationPlanInputError";
  }
}

const PLAN_STEPS: ReadonlyArray<Omit<MigrationStep, "status">> = [
  {
    id: "inspect-files",
    title: "Inspect selected JavaScript files",
    description:
      "Inventory JavaScript and JSX files inside the selected scope before proposing changes.",
  },
  {
    id: "configure-typescript",
    title: "Add or update tsconfig.json",
    description:
      "Prepare TypeScript compiler settings that preserve the repository's current runtime behavior.",
  },
  {
    id: "rename-safe-files",
    title: "Rename safe JavaScript files",
    description:
      "Rename .js and .jsx files to .ts and .tsx only where static inspection marks the boundary as safe.",
  },
  {
    id: "convert-modules",
    title: "Convert obvious module syntax",
    description:
      "Convert straightforward CommonJS imports and exports where the change is unambiguous.",
  },
  {
    id: "add-safe-annotations",
    title: "Add basic TypeScript annotations",
    description:
      "Introduce conservative annotations for obvious values without changing application behavior.",
  },
  {
    id: "run-typecheck",
    title: "Run typecheck",
    description:
      "Run the detected typecheck command and capture diagnostics for review.",
  },
  {
    id: "run-tests",
    title: "Run tests",
    description:
      "Run the detected test command to check behavior after the scoped migration.",
  },
  {
    id: "prepare-diff",
    title: "Prepare reviewable diff",
    description:
      "Group the proposed changes into a focused diff with validation results attached.",
  },
  {
    id: "create-pr",
    title: "Create PR after human approval",
    description:
      "Keep pull request creation blocked until a human approves the plan and resulting diff.",
  },
];

const SENSITIVE_SCOPE_MARKERS = [
  "auth",
  "payment",
  "config",
  "security",
] as const;

export function generateMigrationPlan({
  analysis,
  selectedScope,
}: GenerateMigrationPlanInput): MigrationPlan {
  const scope = normalizeScope(
    selectedScope ?? analysis.recommendedScopes[0]?.path,
  );
  const recommendedScope = analysis.recommendedScopes.find(
    (candidate) => normalizeComparablePath(candidate.path) === scope.toLowerCase(),
  );
  const affectedFilesEstimate =
    recommendedScope?.estimatedFiles ??
    Math.max(1, analysis.jsFiles + analysis.jsxFiles);
  const estimatedRisk = estimatePlanRisk(analysis, scope);
  const target = "JS_TO_TS" as const;

  return {
    id: `plan_${stableHash(`${analysis.repoUrl}|${target}|${scope}`)}`,
    repoUrl: analysis.repoUrl,
    target,
    selectedScope: scope,
    estimatedRisk,
    affectedFilesEstimate,
    validationCommands: buildValidationCommands(analysis),
    steps: PLAN_STEPS.map((step) => ({ ...step, status: "PENDING" })),
    createdAt: new Date().toISOString(),
  };
}

function normalizeScope(value: string | undefined): string {
  const scope = value?.trim().replaceAll("\\", "/").replace(/\/+/g, "/");

  if (!scope) {
    throw new MigrationPlanInputError(
      "SCOPE_REQUIRED",
      "Select a recommended scope before generating a migration plan.",
    );
  }

  const segments = scope.split("/");
  const unsafe =
    scope.startsWith("/") ||
    /^[A-Za-z]:/.test(scope) ||
    scope.length > 300 ||
    /[\0\r\n]/.test(scope) ||
    segments.some((segment) => segment === "..");

  if (unsafe) {
    throw new MigrationPlanInputError(
      "INVALID_SCOPE",
      "The selected scope must be a safe repository-relative path.",
    );
  }

  const normalized = scope.replace(/^\.\//, "").replace(/\/$/, "");

  if (!normalized || normalized === ".") {
    throw new MigrationPlanInputError(
      "SCOPE_REQUIRED",
      "Select a recommended scope before generating a migration plan.",
    );
  }

  return normalized;
}

function normalizeComparablePath(path: string): string {
  return path
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\/|\/$/g, "")
    .toLowerCase();
}

function estimatePlanRisk(
  analysis: RepositoryAnalysis,
  selectedScope: string,
): AnalysisRiskLevel {
  const normalizedScope = selectedScope.toLowerCase();
  const sensitiveScope = SENSITIVE_SCOPE_MARKERS.some((marker) =>
    normalizedScope.includes(marker),
  );

  if (sensitiveScope || analysis.difficulty === "HIGH") return "HIGH";
  if (analysis.difficulty === "MEDIUM") return "MEDIUM";
  return "LOW";
}

function buildValidationCommands(
  analysis: RepositoryAnalysis,
): string[] {
  const command = scriptCommandFactory(analysis.packageManager);
  const commands: string[] = [];

  if (analysis.hasTests) commands.push(command("test"));
  if (analysis.hasBuildScript) commands.push(command("build"));
  if (analysis.hasLintScript) commands.push(command("lint"));
  if (analysis.hasTypecheckScript) commands.push(command("typecheck"));

  return commands;
}

function scriptCommandFactory(
  packageManager: PackageManager,
): (script: string) => string {
  if (packageManager === "pnpm") {
    return (script) => `pnpm ${script}`;
  }

  if (packageManager === "yarn") {
    return (script) => `yarn ${script}`;
  }

  return (script) => (script === "test" ? "npm test" : `npm run ${script}`);
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0).toString(36);
}
