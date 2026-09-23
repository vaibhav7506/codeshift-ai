import {
  approveRequest,
  toApprovalPolicy,
  type ApprovalCategory,
} from "@codeshift/platform/enterprise-runtime";
import {
  apiError,
  assertMutationSecurity,
  requireApiPermission,
  secureJson,
} from "@/lib/enterprise-api";
import { getWorkspaceApprovalPolicy } from "@/lib/workspace-policy-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertMutationSecurity(request);
    const context = requireApiPermission(request, "EXECUTION_APPROVE");
    const body: unknown = await request.json();
    if (!isApprovalBody(body)) throw new Error("A bounded approval request is required.");
    const result = approveRequest({
      id: body.id,
      organizationId: context.organizationId,
      workspaceId: context.workspaceId,
      authorId: body.authorId,
      riskScore: body.riskScore,
      category: body.category,
      validationPassed: body.validationPassed,
      approvals: body.approvals,
      status: "PENDING",
    }, {
      userId: context.userId,
      roles: context.roles,
    }, toApprovalPolicy(getWorkspaceApprovalPolicy(context)));
    return secureJson({ approval: result }, 201);
  } catch (error) {
    return apiError(error);
  }
}

interface ApprovalBody {
  id: string;
  authorId: string;
  riskScore: number;
  category: ApprovalCategory;
  validationPassed: boolean;
  approvals: Array<{ userId: string; decidedAt: string }>;
}

function isApprovalBody(value: unknown): value is ApprovalBody {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.id === "string" && body.id.length <= 100 &&
    typeof body.authorId === "string" && body.authorId.length <= 100 &&
    typeof body.riskScore === "number" && body.riskScore >= 0 && body.riskScore <= 100 &&
    ["STANDARD", "SECURITY", "PLATFORM", "DATABASE"].includes(String(body.category)) &&
    typeof body.validationPassed === "boolean" &&
    Array.isArray(body.approvals) && body.approvals.length <= 10;
}
