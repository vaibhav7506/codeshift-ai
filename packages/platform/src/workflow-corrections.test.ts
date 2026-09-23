import test from "node:test";
import assert from "node:assert/strict";
import {
  createMigrationCampaign,
  resolveCampaignRecipe,
} from "./campaign.js";
import { JS_TO_TS_METADATA } from "./js-to-ts-metadata.js";
import {
  ACTIVE_RECIPE_CATALOG,
  recipeCatalogFromRegistry,
} from "./recipe-catalog.js";
import {
  RecipeRegistry,
  StaticFeatureFlags,
} from "./recipe.js";
import { javaScriptToTypeScriptRecipe } from "./js-to-ts-recipe.js";

test("public registry catalog has no duplicates and classifies completed recipes", () => {
  assert.equal(ACTIVE_RECIPE_CATALOG.length, 16);
  assert.equal(new Set(ACTIVE_RECIPE_CATALOG.map((recipe) => recipe.id)).size, 16);
  assert.equal(
    ACTIVE_RECIPE_CATALOG.filter((recipe) => recipe.status === "active").length,
    12,
  );
  assert.deepEqual(
    ACTIVE_RECIPE_CATALOG
      .filter((recipe) => recipe.status === "assessment")
      .map((recipe) => recipe.id)
      .sort(),
    [
      "deprecated-dependency-report",
      "edge-runtime-report",
      "ef6-to-ef-core",
      "wcf-modernization",
    ],
  );
});

test("internal recipes are omitted and disabled feature flags are coming soon", () => {
  const registry = new RecipeRegistry(new StaticFeatureFlags({ preview: false }));
  registry.register({
    metadata: {
      ...JS_TO_TS_METADATA,
      id: "flagged-recipe",
      name: "Flagged recipe",
    },
    recipe: {
      ...javaScriptToTypeScriptRecipe,
      id: "flagged-recipe",
      name: "Flagged recipe",
    },
    featureFlag: "preview",
  });
  registry.register({
    metadata: {
      ...JS_TO_TS_METADATA,
      id: "internal-recipe",
      name: "Internal recipe",
      visibility: "internal",
    },
    recipe: {
      ...javaScriptToTypeScriptRecipe,
      id: "internal-recipe",
      name: "Internal recipe",
      visibility: "internal",
    },
  });
  const catalog = recipeCatalogFromRegistry(registry);
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0]?.status, "coming-soon");
  assert.equal(catalog[0]?.supportsTransformation, false);
  assert.equal(catalog[0]?.featureFlag, "preview");
});

test("campaigns preserve an explicit selected recipe and legacy campaigns resolve safely", () => {
  const campaign = createMigrationCampaign({
    id: "campaign-express",
    organizationId: "org",
    workspaceId: "workspace",
    repositoryId: "repo",
    name: "Express migration",
    selectedRecipes: [{ id: "express-to-hono", version: "1.0.0" }],
    approvedScope: { paths: ["src"], protectedPaths: [] },
    riskScore: 40,
    estimatedAffectedFiles: 4,
    validationRequirements: ["route-parity"],
  });
  assert.equal(campaign.recipeId, "express-to-hono");
  assert.deepEqual(resolveCampaignRecipe(campaign), {
    id: "express-to-hono",
    version: "1.0.0",
    legacy: false,
  });
  assert.deepEqual(
    resolveCampaignRecipe({
      selectedRecipes: [],
      recipeId: undefined,
      recipeVersion: undefined,
    }),
    { id: "js-to-ts", version: "1.0.0", legacy: true },
  );
});
