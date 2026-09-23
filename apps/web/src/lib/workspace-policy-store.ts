import {
  defaultWorkspaceApprovalPolicy,
  validateWorkspaceApprovalPolicy,
  type WorkspaceApprovalPolicy,
  type WorkspaceKind,
} from "@codeshift/platform/enterprise-runtime";
import { randomUUID } from "node:crypto";

export interface StoredWorkspacePolicy extends WorkspaceApprovalPolicy {
  organizationId: string;
  workspaceId: string;
  workspaceKind: WorkspaceKind;
  version: number;
  updatedAt: string;
}

export interface WorkspacePolicyAuditEvent {
  id: string;
  organizationId: string;
  workspaceId: string;
  actorId: string;
  action: "WORKSPACE_POLICY_UPDATED" | "CAMPAIGN_APPROVAL_RECALCULATED";
  resource: string;
  timestamp: string;
  correlationId: string;
  result: "SUCCESS";
  previous?: Record<string, unknown>;
  next?: Record<string, unknown>;
}

const globalPolicyStore = globalThis as typeof globalThis & {
  __codeshiftWorkspacePolicies?: Map<string, StoredWorkspacePolicy>;
  __codeshiftPolicyAudit?: WorkspacePolicyAuditEvent[];
};

const policies =
  globalPolicyStore.__codeshiftWorkspacePolicies ??
  (globalPolicyStore.__codeshiftWorkspacePolicies =
    new Map<string, StoredWorkspacePolicy>());
const audit =
  globalPolicyStore.__codeshiftPolicyAudit ??
  (globalPolicyStore.__codeshiftPolicyAudit = []);

export function getWorkspaceApprovalPolicy(input: {
  organizationId: string;
  workspaceId: string;
  workspaceKind: WorkspaceKind;
}): StoredWorkspacePolicy {
  const existing = policies.get(input.workspaceId);
  if (existing && existing.organizationId === input.organizationId) {
    return structuredClone(existing);
  }
  const created: StoredWorkspacePolicy = {
    ...defaultWorkspaceApprovalPolicy(input.workspaceKind),
    ...input,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  policies.set(input.workspaceId, structuredClone(created));
  return structuredClone(created);
}

export function updateWorkspaceApprovalPolicy(input: {
  organizationId: string;
  workspaceId: string;
  workspaceKind: WorkspaceKind;
  actorId: string;
  correlationId: string;
  policy: WorkspaceApprovalPolicy;
  now?: string;
}): StoredWorkspacePolicy {
  const previous = getWorkspaceApprovalPolicy(input);
  const validated = validateWorkspaceApprovalPolicy(
    input.workspaceKind,
    input.policy,
  );
  const updated: StoredWorkspacePolicy = {
    ...validated,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    workspaceKind: input.workspaceKind,
    version: previous.version + 1,
    updatedAt: input.now ?? new Date().toISOString(),
  };
  policies.set(input.workspaceId, structuredClone(updated));
  appendWorkspacePolicyAudit({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: "WORKSPACE_POLICY_UPDATED",
    resource: `workspace-policy/${input.workspaceId}`,
    timestamp: updated.updatedAt,
    correlationId: input.correlationId,
    previous: policySnapshot(previous),
    next: policySnapshot(updated),
  });
  return structuredClone(updated);
}

export function appendWorkspacePolicyAudit(
  event: Omit<WorkspacePolicyAuditEvent, "id" | "result">,
): WorkspacePolicyAuditEvent {
  const stored: WorkspacePolicyAuditEvent = {
    ...structuredClone(event),
    id: randomUUID(),
    result: "SUCCESS",
  };
  audit.push(stored);
  return structuredClone(stored);
}

export function listWorkspacePolicyAudit(
  organizationId: string,
  workspaceId: string,
): WorkspacePolicyAuditEvent[] {
  return audit
    .filter((event) =>
      event.organizationId === organizationId &&
      event.workspaceId === workspaceId)
    .map((event) => structuredClone(event));
}

function policySnapshot(
  policy: WorkspaceApprovalPolicy,
): Record<string, unknown> {
  return {
    maximumRiskScore: policy.maximumRiskScore,
    requiredApprovals: policy.requiredApprovals,
    highRiskApprovals: policy.highRiskApprovals,
    authorCanApprove: policy.authorCanApprove,
    requireDistinctApprovers: policy.requireDistinctApprovers,
    allowSourceCodeSharing: policy.allowSourceCodeSharing,
  };
}
