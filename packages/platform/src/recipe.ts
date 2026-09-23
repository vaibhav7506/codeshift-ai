import type {
  MigrationPlan,
  RepositoryAnalysis,
  ValidationResult,
} from "@codeshift/shared";

export type RecipePermission =
  | "read-repository"
  | "write-approved-scope"
  | "write-configuration"
  | "install-dependencies"
  | "run-validation";

export type RecipeCapability =
  | "detect"
  | "assess"
  | "plan"
  | "transform"
  | "validate"
  | "explain"
  | "rollback";

export type RecipeStepKind = "deterministic" | "ai-assisted";

export type RecipeCategory =
  | "language-modules"
  | "backend-runtime"
  | "frontend-styling"
  | "tooling-quality"
  | "dotnet-modernization"
  | "assessment";

export type RecipeExecutionMode = "transform" | "assessment";

export type RecipeVisibility = "public" | "internal";

export interface RecipeFile {
  path: string;
  content?: string;
  size?: number;
}

export interface RepositoryContext {
  repositoryId: string;
  analysis: RepositoryAnalysis;
  files: readonly RecipeFile[];
}

export interface PlanningContext extends RepositoryContext {
  approvedScope: string;
}

export interface TransformContext extends PlanningContext {
  rootPath: string;
  plan: MigrationPlan;
}

export interface ValidationContext extends RepositoryContext {
  plan: MigrationPlan;
  results: readonly ValidationResult[];
}

export interface ExplanationContext extends RepositoryContext {
  plan: MigrationPlan;
  warnings: readonly string[];
}

export interface RollbackContext extends RepositoryContext {
  checkpointId: string;
  approvedBy: string;
}

export interface DetectionResult {
  detected: boolean;
  confidence: number;
  evidence: string[];
}

export interface RiskAssessment {
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  score: number;
  factors: string[];
}

export interface TransformResult {
  changedFiles: string[];
  warnings: string[];
  artifacts: string[];
  fileChanges?: RecipeFileChange[];
}

export interface RecipeFileChange {
  path: string;
  originalCode: string;
  updatedCode: string;
  reason: string;
  confidence: number;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  behaviourPotentiallyAffected: string[];
  testsPerformed: string[];
  validationEvidence: string[];
  unsupportedAssumptions: string[];
  rollbackAction: string;
}

export interface RecipeValidationResult {
  passed: boolean;
  results: readonly ValidationResult[];
  summary: string;
}

export interface ExplanationResult {
  summary: string;
  limitations: string[];
}

export interface RollbackResult {
  checkpointId: string;
  status: "READY";
  requiresApproval: true;
}

export interface RecipeStepDeclaration {
  id: string;
  kind: RecipeStepKind;
  description: string;
}

export interface RecipeMetadata {
  id: string;
  version: string;
  name: string;
  description: string;
  category: RecipeCategory;
  executionMode: RecipeExecutionMode;
  visibility: RecipeVisibility;
  sourceTechnology: string;
  targetTechnology: string;
  supportedVersions: {
    source: string[];
    target: string[];
  };
  requiredTools: string[];
  permissions: RecipePermission[];
  capabilities: RecipeCapability[];
  filesItMayModify: string[];
  dependencies: string[];
  knownLimitations: string[];
  riskFactors: string[];
  validationRequirements: string[];
  rollbackStrategy: string;
  aiUsagePolicy: "disabled" | "optional-with-explicit-consent";
  steps: RecipeStepDeclaration[];
}

export interface MigrationRecipe extends RecipeMetadata {
  detect(context: RepositoryContext): Promise<DetectionResult>;
  assess(context: RepositoryContext): Promise<RiskAssessment>;
  plan(context: PlanningContext): Promise<MigrationPlan>;
  transform(context: TransformContext): Promise<TransformResult>;
  validate(context: ValidationContext): Promise<RecipeValidationResult>;
  explain(context: ExplanationContext): Promise<ExplanationResult>;
  rollback(context: RollbackContext): Promise<RollbackResult>;
}

export interface RecipeRegistration {
  metadata: RecipeMetadata;
  recipe?: MigrationRecipe;
  featureFlag?: string;
}

export interface FeatureFlags {
  isEnabled(flag: string): boolean;
}

export class StaticFeatureFlags implements FeatureFlags {
  constructor(private readonly flags: Readonly<Record<string, boolean>> = {}) {}

  isEnabled(flag: string): boolean {
    return this.flags[flag] === true;
  }
}

export class RecipeRegistry {
  private readonly registrations = new Map<string, RecipeRegistration>();

  constructor(private readonly featureFlags: FeatureFlags = new StaticFeatureFlags()) {}

  register(registration: RecipeRegistration): void {
    const key = recipeKey(registration.metadata.id, registration.metadata.version);

    if (this.registrations.has(key)) {
      throw new Error(`Recipe ${key} is already registered.`);
    }

    this.registrations.set(key, registration);
  }

  get(id: string, version?: string): MigrationRecipe {
    const candidates = [...this.registrations.values()]
      .filter((entry) => entry.metadata.id === id && this.isAvailable(entry))
      .sort((left, right) =>
        right.metadata.version.localeCompare(left.metadata.version, undefined, {
          numeric: true,
        }),
      );
    const registration = version
      ? candidates.find((entry) => entry.metadata.version === version)
      : candidates[0];

    if (!registration?.recipe) {
      throw new Error(`Recipe ${recipeKey(id, version ?? "latest")} is not available.`);
    }

    return registration.recipe;
  }

  list(options: { includeDisabled?: boolean } = {}): RecipeRegistration[] {
    return [...this.registrations.values()]
      .filter((entry) => options.includeDisabled || this.isAvailable(entry))
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));
  }

  isRegistrationAvailable(registration: RecipeRegistration): boolean {
    return this.isAvailable(registration);
  }

  resolveDependencyOrder(recipeIds: readonly string[]): MigrationRecipe[] {
    const selected = new Map(
      recipeIds.map((id) => {
        const recipe = this.get(id);
        return [id, recipe] as const;
      }),
    );
    const ordered: MigrationRecipe[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`Recipe dependency cycle detected at ${id}.`);
      }

      const recipe = selected.get(id);
      if (!recipe) {
        throw new Error(`Recipe dependency ${id} must be selected explicitly.`);
      }

      visiting.add(id);
      recipe.dependencies.forEach(visit);
      visiting.delete(id);
      visited.add(id);
      ordered.push(recipe);
    };

    recipeIds.forEach(visit);
    return ordered;
  }

  private isAvailable(registration: RecipeRegistration): boolean {
    return (
      registration.recipe !== undefined &&
      (registration.featureFlag === undefined ||
        this.featureFlags.isEnabled(registration.featureFlag))
    );
  }
}

function recipeKey(id: string, version: string): string {
  return `${id}@${version}`;
}
