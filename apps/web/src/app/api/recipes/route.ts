import { JS_TO_TS_METADATA } from "@codeshift/platform/js-to-ts-metadata-runtime";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ recipes: [JS_TO_TS_METADATA] });
}
