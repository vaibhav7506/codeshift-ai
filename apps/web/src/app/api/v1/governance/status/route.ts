import { requireApiPermission, apiError, secureJson } from "@/lib/enterprise-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = requireApiPermission(request, "USAGE_READ");
    return secureJson({
      tenant: context,
      workspace: { kind: "PERSONAL", isolation: "STRICT", retentionDays: 30 },
      governance: {
        rbac: "ENFORCED",
        approvals: "REQUIRED",
        auditIntegrity: "VERIFIED",
        sourceCodeSharing: "DENIED_BY_DEFAULT",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
