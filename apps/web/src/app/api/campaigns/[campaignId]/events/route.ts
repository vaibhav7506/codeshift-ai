import { apiError, secureJson } from "@/lib/enterprise-api";
import { appendCampaignEvent, getCampaign } from "@/lib/campaign-store";
import { verifyCampaignToken } from "@/lib/campaign-token";

const EVENT_TYPES = new Set([
  "EXECUTION_STARTED",
  "STAGE_PROGRESS",
  "EXECUTION_COMPLETED",
  "VALIDATION_COMPLETED",
  "EXECUTION_FAILED",
  "ROLLBACK_COMPLETED",
]);
const PAYLOAD_KEYS = new Set([
  "stage",
  "changedFileCount",
  "validationPassed",
  "reportLocation",
  "commitHash",
  "branchName",
  "failureReason",
  "rollbackResult",
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const tokenPayload = verifyCampaignToken(token, campaignId);
    const idempotencyKey = request.headers.get("idempotency-key") ?? "";
    if (!/^[a-zA-Z0-9_.:-]{8,128}$/.test(idempotencyKey)) {
      throw new Error("A stable Idempotency-Key header is required.");
    }
    const stored = getCampaign(campaignId, tokenPayload.workspaceId);
    if (!stored || stored.campaign.status !== "APPROVED") {
      throw new Error("Only an approved campaign can accept execution events.");
    }
    const body: unknown = await request.json();
    if (!isEventBody(body)) throw new Error("The campaign event payload is invalid.");
    const result = appendCampaignEvent(campaignId, tokenPayload.workspaceId, {
      idempotencyKey,
      type: body.type,
      correlationId: body.correlationId,
      occurredAt: new Date().toISOString(),
      payload: body.payload,
    });
    return secureJson({ accepted: true, duplicate: result.duplicate }, result.duplicate ? 200 : 202);
  } catch (error) {
    return apiError(error);
  }
}

function isEventBody(value: unknown): value is {
  type: string;
  correlationId: string;
  payload: Record<string, string | number | boolean>;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  if (
    typeof body.type !== "string" ||
    !EVENT_TYPES.has(body.type) ||
    typeof body.correlationId !== "string" ||
    !/^[a-zA-Z0-9_.:-]{8,128}$/.test(body.correlationId) ||
    !body.payload ||
    typeof body.payload !== "object" ||
    Array.isArray(body.payload)
  ) return false;
  const entries = Object.entries(body.payload as Record<string, unknown>);
  return entries.length <= 10 && entries.every(
    ([key, entry]) =>
      PAYLOAD_KEYS.has(key) &&
      (typeof entry === "boolean" ||
        (typeof entry === "number" && Number.isFinite(entry)) ||
        (typeof entry === "string" &&
          entry.length <= 500 &&
          !/(authorization|api[_-]?key|token|sourceCode)/i.test(entry))),
  );
}
