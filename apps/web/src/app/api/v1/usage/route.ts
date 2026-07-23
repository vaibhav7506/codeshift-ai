import { personalPlan } from "@codeshift/platform/enterprise-runtime";
import { apiError, requireApiPermission, secureJson } from "@/lib/enterprise-api";

export function GET(request: Request) {
  try {
    requireApiPermission(request, "USAGE_READ");
    return secureJson({
      plan: personalPlan,
      usage: {
        ANALYSED_REPOSITORIES: 2,
        CAMPAIGNS: 2,
        RUNNER_MINUTES: 0,
        AI_INPUT_TOKENS: 0,
        AI_OUTPUT_TOKENS: 0,
        AI_COST_MICRO_USD: 0,
        STORAGE_BYTES: 12 * 1024 * 1024,
        VALIDATION_SECONDS: 0,
        CHANGED_FILES: 0,
        GENERATED_REPORTS: 3,
      },
      billingEnabled: false,
    });
  } catch (error) {
    return apiError(error);
  }
}
