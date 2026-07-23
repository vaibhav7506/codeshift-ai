import {
  javaScriptToTypeScriptRecipe,
  JS_TO_TS_METADATA,
} from "./js-to-ts-recipe.js";
import { commonJsToEsmRecipe } from "./commonjs-to-esm.js";
import { expressToHonoRecipe } from "./express-to-hono.js";
import { callbacksToAsyncRecipe } from "./callbacks-to-async.js";
import { reactClassesToHooksRecipe } from "./react-classes-to-hooks.js";
import { cssToTailwindRecipe } from "./css-to-tailwind.js";
import {
  deprecatedDependencyRecipe,
  edgeRuntimeReportRecipe,
  eslintFlatConfigRecipe,
  jestToVitestRecipe,
  typedEnvironmentRecipe,
} from "./additional-recipes.js";
import {
  aspNetCoreRecipe,
  dotNetFrameworkRecipe,
  ef6ToEfCoreRecipe,
  wcfModernizationRecipe,
  windowsServiceToWorkerRecipe,
} from "./dotnet-recipes.js";
import { RecipeRegistry, StaticFeatureFlags } from "./recipe.js";

export function createDefaultRecipeRegistry(
  flags: Readonly<Record<string, boolean>> = {},
): RecipeRegistry {
  const registry = new RecipeRegistry(new StaticFeatureFlags(flags));
  registry.register({
    metadata: JS_TO_TS_METADATA,
    recipe: javaScriptToTypeScriptRecipe,
  });
  for (const recipe of [
    commonJsToEsmRecipe,
    expressToHonoRecipe,
    callbacksToAsyncRecipe,
    reactClassesToHooksRecipe,
    cssToTailwindRecipe,
    eslintFlatConfigRecipe,
    jestToVitestRecipe,
    typedEnvironmentRecipe,
    deprecatedDependencyRecipe,
    edgeRuntimeReportRecipe,
    dotNetFrameworkRecipe,
    aspNetCoreRecipe,
    ef6ToEfCoreRecipe,
    wcfModernizationRecipe,
    windowsServiceToWorkerRecipe,
  ]) {
    registry.register({
      metadata: recipe,
      recipe,
    });
  }

  return registry;
}
