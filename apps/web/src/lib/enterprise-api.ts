import {
  InMemoryGovernanceRepository,
  authorize,
  bootstrapPersonalWorkspace,
  enterpriseRoles,
  secureResponseHeaders,
  SlidingWindowRateLimiter,
  verifyWebhookSignature,
  type EnterprisePermission,
  type EnterpriseRole,
  type TenantContext,
} from "@codeshift/platform/enterprise-runtime";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

const apiRateLimiter = new SlidingWindowRateLimiter(120, 60_000);

export function requireApiPermission(
  request: Request,
  permission: EnterprisePermission,
): TenantContext & { roles: EnterpriseRole[] } {
  const identity = resolveIdentity(request);
  const { userId } = identity;
  if (!apiRateLimiter.allow(userId)) throw new ApiError("RATE_LIMITED", 429);
  const personal = bootstrapPersonalWorkspace(userId);
  const context = {
    organizationId: identity.organizationId ?? personal.organization.id,
    workspaceId: identity.workspaceId ?? personal.workspace.id,
    userId,
    roles: [identity.role],
  };
  const repository = new InMemoryGovernanceRepository();
  repository.saveOrganization({ ...personal.organization, id: context.organizationId });
  repository.saveWorkspace({
    ...personal.workspace,
    id: context.workspaceId,
    organizationId: context.organizationId,
  });
  repository.saveMembership({
    organizationId: context.organizationId,
    workspaceId: context.workspaceId,
    userId,
    roles: context.roles,
    status: "ACTIVE",
  });
  authorize(repository, context, permission);
  return context;
}

export function assertMutationSecurity(request: Request, maximumBytes = 32_768): void {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(length) || length > maximumBytes) throw new ApiError("PAYLOAD_TOO_LARGE", 413);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ApiError("CROSS_ORIGIN_REQUEST", 403);
  if (request.headers.get("x-codeshift-csrf") !== "1") throw new ApiError("CSRF_TOKEN_REQUIRED", 403);
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message = code,
  ) {
    super(message);
  }
}

export function apiError(error: unknown): NextResponse {
  const requestId = randomUUID();
  const status = error instanceof ApiError
    ? error.status
    : error instanceof Error && "code" in error && error.code === "FORBIDDEN"
      ? 403
      : 400;
  const code = error instanceof ApiError ? error.code : status === 403 ? "FORBIDDEN" : "INVALID_REQUEST";
  return secureJson({
    error: {
      code,
      message: error instanceof Error ? error.message : "Request failed.",
      requestId,
    },
  }, status, requestId);
}

export function secureJson(body: unknown, status = 200, requestId?: string): NextResponse {
  const response = NextResponse.json(body, { status });
  for (const [name, value] of Object.entries(secureResponseHeaders)) {
    response.headers.set(name, value);
  }
  response.headers.set("Cache-Control", "no-store");
  if (requestId) response.headers.set("X-Request-Id", requestId);
  return response;
}

function resolveIdentity(request: Request): {
  userId: string;
  organizationId?: string;
  workspaceId?: string;
  role: EnterpriseRole;
} {
  const userId = boundedHeader(request, "x-codeshift-user");
  const organizationId = boundedHeader(request, "x-codeshift-organization");
  const workspaceId = boundedHeader(request, "x-codeshift-workspace");
  const roleHeader = boundedHeader(request, "x-codeshift-role");
  const hasGatewayIdentity = !!(userId || organizationId || workspaceId || roleHeader);
  if (!hasGatewayIdentity) return { userId: "personal-user", role: "OWNER" };

  const identitySecret = process.env.CODESHIFT_IDENTITY_SECRET;
  if (!identitySecret || !userId || !organizationId || !workspaceId || !roleHeader) {
    throw new ApiError("IDENTITY_GATEWAY_NOT_CONFIGURED", 503);
  }
  if (!enterpriseRoles.includes(roleHeader as EnterpriseRole)) {
    throw new ApiError("INVALID_IDENTITY_ROLE", 401);
  }
  const canonical = `${userId}:${organizationId}:${workspaceId}:${roleHeader}`;
  const signature = request.headers.get("x-codeshift-identity-signature") ?? "";
  if (!verifyWebhookSignature(canonical, signature, identitySecret)) {
    throw new ApiError("INVALID_IDENTITY_SIGNATURE", 401);
  }
  return {
    userId,
    organizationId,
    workspaceId,
    role: roleHeader as EnterpriseRole,
  };
}

function boundedHeader(request: Request, name: string): string | undefined {
  const value = request.headers.get(name)?.trim();
  if (!value) return undefined;
  if (value.length > 128 || !/^[a-zA-Z0-9_.:@/-]+$/.test(value)) {
    throw new ApiError("INVALID_IDENTITY_HEADER", 400);
  }
  return value;
}
