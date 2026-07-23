import { ACTIVE_RECIPE_CATALOG } from "@codeshift/platform/recipe-catalog-runtime";
import { NextResponse } from "next/server";
import { apiError, requireApiPermission } from "@/lib/enterprise-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requireApiPermission(request, "USAGE_READ");
    return NextResponse.json({ recipes: ACTIVE_RECIPE_CATALOG });
  } catch (error) {
    return apiError(error);
  }
}
