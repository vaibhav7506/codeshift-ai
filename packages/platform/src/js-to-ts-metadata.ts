import type { RecipeMetadata } from "./recipe.js";

export const JS_TO_TS_METADATA: RecipeMetadata = {
  id: "js-to-ts",
  version: "1.0.0",
  name: "JavaScript to TypeScript",
  description:
    "Wraps the existing scoped JavaScript-to-TypeScript workflow in the versioned recipe contract.",
  sourceTechnology: "JavaScript",
  targetTechnology: "TypeScript",
  supportedVersions: {
    source: ["ECMAScript 2015+"],
    target: ["TypeScript 5.x"],
  },
  requiredTools: ["Node.js 20+", "TypeScript"],
  permissions: [
    "read-repository",
    "write-approved-scope",
    "write-configuration",
    "run-validation",
  ],
  capabilities: [
    "detect",
    "assess",
    "plan",
    "transform",
    "validate",
    "explain",
    "rollback",
  ],
  filesItMayModify: [
    "<approved-scope>/**/*.js",
    "<approved-scope>/**/*.jsx",
    "tsconfig.json",
    ".codeshift-ai/*",
  ],
  dependencies: [],
  knownLimitations: [
    "Dynamic CommonJS patterns remain unchanged.",
    "Type annotations are intentionally conservative.",
  ],
  riskFactors: [
    "Mixed module systems",
    "Missing tests",
    "Dynamic require calls",
    "Sensitive application paths",
  ],
  validationRequirements: ["typecheck", "test", "build", "lint"],
  rollbackStrategy:
    "Restore the approved checkpoint or apply the exported reverse patch.",
  aiUsagePolicy: "optional-with-explicit-consent",
  steps: [
    {
      id: "inspect",
      kind: "deterministic",
      description: "Inspect only the approved repository scope.",
    },
    {
      id: "transform",
      kind: "deterministic",
      description: "Apply the existing conservative migration implementation.",
    },
    {
      id: "explain",
      kind: "ai-assisted",
      description: "Optionally explain blockers after explicit consent.",
    },
  ],
};
