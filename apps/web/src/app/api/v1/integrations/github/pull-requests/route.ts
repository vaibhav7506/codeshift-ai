import {
  assertPullRequestGate,
  type ApprovalRequest,
} from "@codeshift/platform/enterprise-runtime";
import {
  apiError,
  assertMutationSecurity,
  requireApiPermission,
  secureJson,
} from "@/lib/enterprise-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertMutationSecurity(request);
    const context = requireApiPermission(request, "INTEGRATION_MANAGE");
    const body: unknown = await request.json();
    if (!isPullRequestBody(body)) throw new Error("A validated, approved pull request payload is required.");
    assertPullRequestGate({
      approval: body.approval,
      policyAllowed: body.policyAllowed,
      validationPassed: body.validationPassed,
    });
    return secureJson({
      pullRequest: {
        id: `pending-${body.repository.replace(/[^a-z0-9]/gi, "-")}`,
        repository: body.repository,
        branch: body.branch,
        status: "QUEUED",
        organizationId: context.organizationId,
        workspaceId: context.workspaceId,
      },
    }, 202);
  } catch (error) {
    return apiError(error);
  }
}

function isPullRequestBody(value: unknown): value is {
  repository: string;
  branch: string;
  approval: ApprovalRequest;
  policyAllowed: boolean;
  validationPassed: boolean;
} {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  const approval = body.approval as Partial<ApprovalRequest> | undefined;
  return typeof body.repository === "string" && body.repository.length <= 200 &&
    typeof body.branch === "string" && body.branch.length <= 200 &&
    typeof body.policyAllowed === "boolean" &&
    typeof body.validationPassed === "boolean" &&
    !!approval && approval.status === "APPROVED" &&
    typeof approval.validationPassed === "boolean";
}
