import type {
  RecipeCategory,
  RecipeMetadata,
  RecipePermission,
} from "./recipe.js";

export function modernizationMetadata(input: {
  id: string;
  name: string;
  description: string;
  category: RecipeCategory;
  assessmentOnly?: boolean;
  visibility?: "public" | "internal";
  sourceTechnology: string;
  targetTechnology: string;
  sourceVersions?: string[];
  targetVersions?: string[];
  requiredTools?: string[];
  permissions?: RecipePermission[];
  filesItMayModify: string[];
  dependencies?: string[];
  knownLimitations: string[];
  riskFactors: string[];
  validationRequirements?: string[];
  rollbackStrategy?: string;
}): RecipeMetadata {
  return {
    id: input.id,
    version: "1.0.0",
    name: input.name,
    description: input.description,
    category: input.category,
    executionMode: input.assessmentOnly ? "assessment" : "transform",
    visibility: input.visibility ?? "public",
    sourceTechnology: input.sourceTechnology,
    targetTechnology: input.targetTechnology,
    supportedVersions: {
      source: input.sourceVersions ?? ["supported project versions"],
      target: input.targetVersions ?? ["current configured target"],
    },
    requiredTools: input.requiredTools ?? ["Node.js 20+"],
    permissions: input.permissions ?? [
      "read-repository",
      "write-approved-scope",
      "run-validation",
    ],
    capabilities: input.assessmentOnly
      ? ["detect", "assess", "plan", "validate", "explain"]
      : [
          "detect",
          "assess",
          "plan",
          "transform",
          "validate",
          "explain",
          "rollback",
        ],
    filesItMayModify: input.filesItMayModify,
    dependencies: input.dependencies ?? [],
    knownLimitations: input.knownLimitations,
    riskFactors: input.riskFactors,
    validationRequirements: input.validationRequirements ?? [
      "test",
      "build",
      "typecheck",
      "lint",
    ],
    rollbackStrategy:
      input.rollbackStrategy ?? "Restore the stage checkpoint and reverse patch.",
    aiUsagePolicy: "optional-with-explicit-consent",
    steps: [
      {
        id: "detect",
        kind: "deterministic",
        description: `Detect supported ${input.sourceTechnology} patterns.`,
      },
      {
        id: "transform",
        kind: "deterministic",
        description: `Transform only patterns proven safe for ${input.targetTechnology}.`,
      },
      {
        id: "validate",
        kind: "deterministic",
        description: "Run declared behavioural and repository validation contracts.",
      },
      {
        id: "explain",
        kind: "ai-assisted",
        description: "Optionally explain unsupported patterns after explicit consent.",
      },
    ],
  };
}
