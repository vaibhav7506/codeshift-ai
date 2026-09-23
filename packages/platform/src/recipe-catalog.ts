import { createDefaultRecipeRegistry } from "./registry.js";
import type {
  RecipeCapability,
  RecipeCategory,
  RecipeRegistry,
} from "./recipe.js";

export type RecipeCatalogStatus = "active" | "assessment" | "coming-soon";

export interface RecipeCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: RecipeCategory;
  sourceTechnology: string;
  targetTechnology: string;
  version: string;
  status: RecipeCatalogStatus;
  featureFlag: string | null;
  supportsTransformation: boolean;
  assessmentOnly: boolean;
  supportedVersions: {
    source: string[];
    target: string[];
  };
  capabilities: Record<RecipeCapability, boolean>;
  filesItMayModify: string[];
  validationRequirements: string[];
}

const CAPABILITIES: readonly RecipeCapability[] = [
  "detect",
  "assess",
  "plan",
  "transform",
  "validate",
  "explain",
  "rollback",
];

export function recipeCatalogFromRegistry(
  registry: RecipeRegistry,
): RecipeCatalogEntry[] {
  return registry
    .list({ includeDisabled: true })
    .filter(({ metadata }) => metadata.visibility === "public")
    .map((registration): RecipeCatalogEntry => {
      const { metadata } = registration;
      const capabilities = Object.fromEntries(
        CAPABILITIES.map((capability) => [
          capability,
          metadata.capabilities.includes(capability),
        ]),
      ) as Record<RecipeCapability, boolean>;
      const executableContract =
        capabilities.detect &&
        capabilities.plan &&
        capabilities.transform &&
        capabilities.validate;
      const available = registry.isRegistrationAvailable(registration);
      const assessmentOnly = metadata.executionMode === "assessment";
      const status: RecipeCatalogStatus = !available
        ? "coming-soon"
        : assessmentOnly
          ? "assessment"
          : executableContract
            ? "active"
            : "coming-soon";

      return {
        id: metadata.id,
        name: metadata.name,
        description: metadata.description,
        category: metadata.category,
        sourceTechnology: metadata.sourceTechnology,
        targetTechnology: metadata.targetTechnology,
        version: metadata.version,
        status,
        featureFlag: registration.featureFlag ?? null,
        supportsTransformation: available && executableContract,
        assessmentOnly,
        supportedVersions: metadata.supportedVersions,
        capabilities,
        filesItMayModify: metadata.filesItMayModify,
        validationRequirements: metadata.validationRequirements,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getRecipeCatalogEntry(
  recipeId: string,
  registry = createDefaultRecipeRegistry(),
): RecipeCatalogEntry | undefined {
  return recipeCatalogFromRegistry(registry).find(
    (recipe) => recipe.id === recipeId,
  );
}

export const ACTIVE_RECIPE_CATALOG = recipeCatalogFromRegistry(
  createDefaultRecipeRegistry(),
);
