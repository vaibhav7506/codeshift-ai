export type MigrationStage =
  | "repo"
  | "analysis"
  | "plan"
  | "patch"
  | "validate"
  | "review"
  | "pr";

export type RecipeAvailability = "active" | "coming-soon";

export interface MigrationRecipe {
  id: string;
  label: string;
  availability: RecipeAvailability;
}

export type AnalysisRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type PackageManager = "npm" | "pnpm" | "yarn" | "unknown";

export type RepositoryFramework =
  | "react"
  | "next"
  | "express"
  | "node"
  | "vite"
  | "unknown";

export type ModuleSystem = "commonjs" | "esm" | "mixed" | "unknown";

export interface RiskFactor {
  id: string;
  title: string;
  description: string;
  severity: AnalysisRiskLevel;
}

export interface RecommendedScope {
  path: string;
  reason: string;
  estimatedFiles: number;
  risk: AnalysisRiskLevel;
}

export interface RepositoryAnalysis {
  repoUrl: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  packageManager: PackageManager;
  framework: RepositoryFramework;
  moduleSystem: ModuleSystem;
  totalFiles: number;
  jsFiles: number;
  tsFiles: number;
  jsxFiles: number;
  tsxFiles: number;
  hasTsConfig: boolean;
  hasTests: boolean;
  hasBuildScript: boolean;
  hasLintScript: boolean;
  hasTypecheckScript: boolean;
  riskFactors: RiskFactor[];
  recommendedScopes: RecommendedScope[];
  readinessScore: number;
  difficulty: AnalysisRiskLevel;
}

export type MigrationTarget =
  | "JS_TO_TS"
  | "COMMONJS_TO_ESM"
  | "EXPRESS_TO_HONO"
  | "CALLBACKS_TO_ASYNC"
  | "REACT_CLASSES_TO_HOOKS"
  | "CSS_TO_TAILWIND"
  | "ESLINT_FLAT_CONFIG"
  | "JEST_TO_VITEST"
  | "TYPED_ENV_CONFIG"
  | "DEPRECATED_DEPENDENCY_REPORT"
  | "EDGE_RUNTIME_REPORT"
  | "DOTNET_FRAMEWORK_TO_MODERN"
  | "ASPNET_TO_ASPNET_CORE"
  | "EF6_TO_EF_CORE"
  | "WCF_MODERNIZATION"
  | "WINDOWS_SERVICE_TO_WORKER";

export type MigrationStepStatus =
  | "PENDING"
  | "RUNNING"
  | "DONE"
  | "FAILED";

export interface MigrationStep {
  id: string;
  title: string;
  description: string;
  status: MigrationStepStatus;
}

export interface MigrationPlan {
  id: string;
  repoUrl: string;
  target: MigrationTarget;
  selectedScope: string;
  estimatedRisk: AnalysisRiskLevel;
  affectedFilesEstimate: number;
  validationCommands: string[];
  steps: MigrationStep[];
  createdAt: string;
}

export interface MigrationSummary {
  target: MigrationTarget;
  selectedScope: string;
  changedFiles: string[];
  warnings: string[];
  tsconfigChanged: boolean;
  createdAt: string;
}

export type ValidationStatus = "PASSED" | "FAILED" | "SKIPPED";

export interface ValidationResult {
  command: string;
  status: ValidationStatus;
  logs: string;
  durationMs?: number;
}
