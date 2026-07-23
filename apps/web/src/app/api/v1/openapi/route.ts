import { codeShiftOpenApi } from "@/lib/openapi";
import { secureJson } from "@/lib/enterprise-api";

export function GET() {
  return secureJson(codeShiftOpenApi);
}
