import { POST as createCampaign } from "../../campaigns/route";
import { ApiError, apiError, requireApiPermission, secureJson } from "@/lib/enterprise-api";
import { paginate, paginationFromRequest } from "@/lib/api-contract";

export function POST(request: Request) {
  const key = request.headers.get("idempotency-key");
  if (!key || !/^[a-zA-Z0-9_.:-]{8,128}$/.test(key)) {
    return apiError(new ApiError(
      "IDEMPOTENCY_KEY_REQUIRED",
      400,
      "A stable Idempotency-Key header is required.",
    ));
  }
  return createCampaign(request);
}

export function GET(request: Request) {
  try {
    requireApiPermission(request, "USAGE_READ");
    return secureJson(paginate([], paginationFromRequest(request)));
  } catch (error) {
    return apiError(error);
  }
}
