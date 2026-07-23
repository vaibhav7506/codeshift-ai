import { verifyWebhookSignature } from "@codeshift/platform/enterprise-runtime";
import { apiError, secureJson } from "@/lib/enterprise-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > 1_048_576) return secureJson({ error: { code: "PAYLOAD_TOO_LARGE" } }, 413);
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) return secureJson({ error: { code: "INTEGRATION_NOT_CONFIGURED" } }, 503);
    const payload = await request.text();
    const signature = request.headers.get("x-hub-signature-256") ?? "";
    if (!verifyWebhookSignature(payload, signature, secret)) {
      return secureJson({ error: { code: "INVALID_WEBHOOK_SIGNATURE" } }, 401);
    }
    return secureJson({ accepted: true }, 202);
  } catch (error) {
    return apiError(error);
  }
}
