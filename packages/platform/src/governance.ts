export const enterpriseRoles = [
  "OWNER",
  "ADMINISTRATOR",
  "PLATFORM_ENGINEER",
  "MIGRATION_AUTHOR",
  "REVIEWER",
  "APPROVER",
  "DEVELOPER",
  "AUDITOR",
  "READ_ONLY",
] as const;

export type EnterpriseRole = (typeof enterpriseRoles)[number];

export const enterprisePermissions = [
  "REPOSITORY_CONNECT",
  "ANALYSIS_RUN",
  "CAMPAIGN_MANAGE",
  "SCOPE_APPROVE",
  "EXECUTION_APPROVE",
  "AI_CONFIGURE",
  "RUNNER_MANAGE",
  "RETENTION_MANAGE",
  "AUDIT_READ",
  "INTEGRATION_MANAGE",
  "BILLING_READ",
  "USAGE_READ",
  "ORGANIZATION_MANAGE",
] as const;

export type EnterprisePermission = (typeof enterprisePermissions)[number];

const allPermissions = new Set<EnterprisePermission>(enterprisePermissions);
const rolePermissions: Record<EnterpriseRole, ReadonlySet<EnterprisePermission>> = {
  OWNER: allPermissions,
  ADMINISTRATOR: allPermissions,
  PLATFORM_ENGINEER: new Set([
    "REPOSITORY_CONNECT", "ANALYSIS_RUN", "CAMPAIGN_MANAGE", "SCOPE_APPROVE",
    "EXECUTION_APPROVE", "RUNNER_MANAGE", "AUDIT_READ", "INTEGRATION_MANAGE",
    "USAGE_READ",
  ]),
  MIGRATION_AUTHOR: new Set([
    "REPOSITORY_CONNECT", "ANALYSIS_RUN", "CAMPAIGN_MANAGE", "USAGE_READ",
  ]),
  REVIEWER: new Set(["ANALYSIS_RUN", "SCOPE_APPROVE", "AUDIT_READ", "USAGE_READ"]),
  APPROVER: new Set(["SCOPE_APPROVE", "EXECUTION_APPROVE", "AUDIT_READ", "USAGE_READ"]),
  DEVELOPER: new Set(["ANALYSIS_RUN", "USAGE_READ"]),
  AUDITOR: new Set(["AUDIT_READ", "BILLING_READ", "USAGE_READ"]),
  READ_ONLY: new Set(["USAGE_READ"]),
};

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  kind: "PERSONAL" | "ORGANIZATION";
  retentionDays: number;
  createdAt: string;
}

export interface Membership {
  organizationId: string;
  workspaceId: string;
  userId: string;
  roles: EnterpriseRole[];
  status: "ACTIVE" | "SUSPENDED";
}

export interface WorkspaceInvitation {
  id: string;
  organizationId: string;
  workspaceId: string;
  email: string;
  roles: EnterpriseRole[];
  invitedBy: string;
  expiresAt: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
}

export interface RepositoryOwnership {
  organizationId: string;
  workspaceId: string;
  repositoryId: string;
  provider: string;
  externalId: string;
}

export interface TenantContext {
  organizationId: string;
  workspaceId: string;
  userId: string;
}

export class AuthorizationError extends Error {
  readonly code = "FORBIDDEN";
}

export class InMemoryGovernanceRepository {
  readonly organizations = new Map<string, Organization>();
  readonly workspaces = new Map<string, Workspace>();
  readonly memberships = new Map<string, Membership>();
  readonly invitations = new Map<string, WorkspaceInvitation>();
  readonly repositories = new Map<string, RepositoryOwnership>();

  saveOrganization(value: Organization): void {
    this.organizations.set(value.id, structuredClone(value));
  }

  saveWorkspace(value: Workspace): void {
    const organization = this.organizations.get(value.organizationId);
    if (!organization) throw new Error("Workspace organization does not exist.");
    this.workspaces.set(value.id, structuredClone(value));
  }

  saveMembership(value: Membership): void {
    this.requireWorkspace(value.organizationId, value.workspaceId);
    this.memberships.set(membershipKey(value), structuredClone(value));
  }

  saveInvitation(value: WorkspaceInvitation): void {
    this.requireWorkspace(value.organizationId, value.workspaceId);
    this.invitations.set(value.id, structuredClone(value));
  }

  listInvitations(context: TenantContext): WorkspaceInvitation[] {
    authorize(this, context, "ORGANIZATION_MANAGE");
    return [...this.invitations.values()]
      .filter((item) =>
        item.organizationId === context.organizationId &&
        item.workspaceId === context.workspaceId)
      .map((item) => structuredClone(item));
  }

  saveRepository(value: RepositoryOwnership): void {
    this.requireWorkspace(value.organizationId, value.workspaceId);
    this.repositories.set(`${value.organizationId}:${value.workspaceId}:${value.repositoryId}`, structuredClone(value));
  }

  getWorkspace(context: Pick<TenantContext, "organizationId" | "workspaceId">): Workspace {
    return structuredClone(this.requireWorkspace(context.organizationId, context.workspaceId));
  }

  getMembership(context: TenantContext): Membership | undefined {
    const result = this.memberships.get(membershipKey(context));
    return result ? structuredClone(result) : undefined;
  }

  listRepositories(context: TenantContext): RepositoryOwnership[] {
    authorize(this, context, "USAGE_READ");
    return [...this.repositories.values()]
      .filter((item) =>
        item.organizationId === context.organizationId &&
        item.workspaceId === context.workspaceId)
      .map((item) => structuredClone(item));
  }

  private requireWorkspace(organizationId: string, workspaceId: string): Workspace {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace || workspace.organizationId !== organizationId) {
      throw new AuthorizationError("Workspace is outside the active tenant.");
    }
    return workspace;
  }
}

export function authorize(
  repository: InMemoryGovernanceRepository,
  context: TenantContext,
  permission: EnterprisePermission,
): Membership {
  repository.getWorkspace(context);
  const membership = repository.getMembership(context);
  if (
    !membership ||
    membership.status !== "ACTIVE" ||
    !membership.roles.some((role) => rolePermissions[role].has(permission))
  ) {
    throw new AuthorizationError(`Permission ${permission} is required.`);
  }
  return membership;
}

export function bootstrapPersonalWorkspace(
  userId: string,
  now = new Date().toISOString(),
): {
  organization: Organization;
  workspace: Workspace;
  membership: Membership;
} {
  const suffix = normalizeIdentifier(userId);
  const organization: Organization = {
    id: `personal-${suffix}`,
    name: "Personal organization",
    createdAt: now,
  };
  const workspace: Workspace = {
    id: `personal-${suffix}`,
    organizationId: organization.id,
    name: "Personal workspace",
    kind: "PERSONAL",
    retentionDays: 30,
    createdAt: now,
  };
  return {
    organization,
    workspace,
    membership: {
      organizationId: organization.id,
      workspaceId: workspace.id,
      userId,
      roles: ["OWNER"],
      status: "ACTIVE",
    },
  };
}

function membershipKey(value: Pick<Membership, "organizationId" | "workspaceId" | "userId">): string {
  return `${value.organizationId}:${value.workspaceId}:${value.userId}`;
}

function normalizeIdentifier(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!normalized) throw new Error("User identifier must contain a letter or number.");
  return normalized.slice(0, 64);
}
