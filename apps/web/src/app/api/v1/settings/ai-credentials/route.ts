import { randomBytes } from "node:crypto";
import { EncryptedAiCredentialVault } from "@codeshift/platform/enterprise-runtime";
import {
  apiError,
  assertMutationSecurity,
  requireApiPermission,
  secureJson,
} from "@/lib/enterprise-api";

export const runtime = "nodejs";

const vault = new EncryptedAiCredentialVault(randomBytes(32));

export async function POST(request: Request) {
  try {
    assertMutationSecurity(request, 8_192);
    const context = requireApiPermission(request, "AI_CONFIGURE");
    const body: unknown = await request.json();
    if (!isCredentialBody(body)) throw new Error("Provider, model, and a valid API key are required.");
    const id = `${context.workspaceId}:${body.provider}`;
    vault.store({
      id,
      organizationId: context.organizationId,
      workspaceId: context.workspaceId,
      provider: body.provider,
      model: body.model,
      apiKey: body.apiKey,
      sourceCodeConsent: body.sourceCodeConsent,
      retentionDays: body.retentionDays,
    });
    return secureJson({ credential: vault.describe(
      id,
      context.organizationId,
      context.workspaceId,
    ) }, 201);
  } catch (error) {
    return apiError(error);
  }
}

function isCredentialBody(value: unknown): value is {
  provider: string;
  model: string;
  apiKey: string;
  sourceCodeConsent: boolean;
  retentionDays: number;
} {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.provider === "string" && body.provider.length <= 50 &&
    typeof body.model === "string" && body.model.length <= 100 &&
    typeof body.apiKey === "string" && body.apiKey.length >= 8 && body.apiKey.length <= 500 &&
    typeof body.sourceCodeConsent === "boolean" &&
    typeof body.retentionDays === "number" &&
    Number.isInteger(body.retentionDays) && body.retentionDays >= 0 && body.retentionDays <= 365;
}
