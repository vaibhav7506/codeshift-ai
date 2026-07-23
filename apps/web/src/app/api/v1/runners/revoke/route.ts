import { RunnerRegistry } from "@codeshift/platform/enterprise-runtime";
import {
  apiError,
  assertMutationSecurity,
  requireApiPermission,
  secureJson,
} from "@/lib/enterprise-api";

export const runtime = "nodejs";

const registry = new RunnerRegistry();

export async function POST(request: Request) {
  try {
    assertMutationSecurity(request, 4_096);
    const context = requireApiPermission(request, "RUNNER_MANAGE");
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || typeof (body as { runnerId?: unknown }).runnerId !== "string") {
      throw new Error("A runner identifier is required.");
    }
    const runnerId = (body as { runnerId: string }).runnerId;
    if (runnerId.length > 100) throw new Error("Runner identifier is too long.");
    const token = registry.createPairingToken(context.organizationId, context.workspaceId);
    registry.register(token, {
      id: runnerId,
      identity: `spiffe://codeshift/${runnerId}`,
      labels: ["managed"],
      runtimes: ["node20"],
      capacity: 1,
      version: "1.0.0",
    });
    return secureJson({ runner: registry.revoke(
      runnerId,
      context.organizationId,
      context.workspaceId,
    ) });
  } catch (error) {
    return apiError(error);
  }
}
