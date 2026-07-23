import { ACTIVE_RECIPE_CATALOG } from "@codeshift/platform/recipe-catalog-runtime";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ recipes: ACTIVE_RECIPE_CATALOG });
}
