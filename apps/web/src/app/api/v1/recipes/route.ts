import { ACTIVE_RECIPE_CATALOG } from "@codeshift/platform/recipe-catalog-runtime";
import { paginate, paginationFromRequest } from "@/lib/api-contract";
import { apiError, requireApiPermission, secureJson } from "@/lib/enterprise-api";
import { withHttpTelemetry } from "@/lib/runtime-telemetry";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withHttpTelemetry(request, "recipes.list", () => {
   try {
    requireApiPermission(request, "USAGE_READ");
    const input = paginationFromRequest(request);
    const filter = input.filter?.toLowerCase();
    const recipes = ACTIVE_RECIPE_CATALOG
      .filter((recipe) =>
        !filter ||
        recipe.name.toLowerCase().includes(filter) ||
        recipe.id.toLowerCase().includes(filter))
      .sort((left, right) => {
        const comparison = left.name.localeCompare(right.name);
        return input.sort === "asc" ? comparison : -comparison;
      });
    return secureJson(paginate(recipes, input));
    } catch (error) {
      return apiError(error);
    }
  });
}
