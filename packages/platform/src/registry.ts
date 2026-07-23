import {
  javaScriptToTypeScriptRecipe,
  JS_TO_TS_METADATA,
} from "./js-to-ts-recipe.js";
import {
  RecipeRegistry,
  StaticFeatureFlags,
  type RecipeMetadata,
} from "./recipe.js";

const INCOMPLETE_RECIPES: Array<{
  flag: string;
  metadata: RecipeMetadata;
}> = [
  incompleteRecipe("commonjs-to-esm", "CommonJS to ESM", "CommonJS", "ESM"),
  incompleteRecipe("express-to-hono", "Express to Hono", "Express", "Hono"),
  incompleteRecipe(
    "callbacks-to-async",
    "Callbacks to async/await",
    "Node.js callbacks",
    "async/await",
  ),
  incompleteRecipe(
    "classes-to-hooks",
    "React classes to hooks",
    "React class components",
    "React hooks",
  ),
  incompleteRecipe("css-to-tailwind", "CSS to Tailwind CSS", "CSS", "Tailwind CSS"),
];

export function createDefaultRecipeRegistry(
  flags: Readonly<Record<string, boolean>> = {},
): RecipeRegistry {
  const registry = new RecipeRegistry(new StaticFeatureFlags(flags));
  registry.register({
    metadata: JS_TO_TS_METADATA,
    recipe: javaScriptToTypeScriptRecipe,
  });

  for (const entry of INCOMPLETE_RECIPES) {
    registry.register({
      metadata: entry.metadata,
      featureFlag: entry.flag,
    });
  }

  return registry;
}

function incompleteRecipe(
  id: string,
  name: string,
  sourceTechnology: string,
  targetTechnology: string,
): { flag: string; metadata: RecipeMetadata } {
  return {
    flag: `recipe.${id}`,
    metadata: {
      id,
      version: "0.0.0",
      name,
      description: `${name} is registered for future development but is disabled by default.`,
      sourceTechnology,
      targetTechnology,
      supportedVersions: { source: [], target: [] },
      requiredTools: [],
      permissions: ["read-repository"],
      capabilities: ["detect", "assess"],
      filesItMayModify: [],
      dependencies: [],
      knownLimitations: ["Not implemented in Phase 1."],
      riskFactors: [],
      validationRequirements: [],
      rollbackStrategy: "No transformations are available.",
      aiUsagePolicy: "disabled",
      steps: [],
    },
  };
}
