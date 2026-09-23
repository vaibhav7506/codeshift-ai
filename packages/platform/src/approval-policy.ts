export type ApprovalCategory = "STANDARD" | "SECURITY" | "PLATFORM" | "DATABASE";

export interface ApprovalRequest {
  id: string;
  organizationId: string;
  workspaceId: string;
  authorId: string;
  riskScore: number;
  category: ApprovalCategory;
  validationPassed: boolean;
  approvals: Array<{ userId: string; decidedAt: string }>;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface ApprovalPolicy {
  highRiskThreshold: number;
  requiredApprovals: number;
  highRiskApprovals: number;
  authorCanApprove: boolean;
  requireDistinctApprovers: boolean;
  specialistRoles: Record<Exclude<ApprovalCategory, "STANDARD">, string>;
}

export const defaultApprovalPolicy: ApprovalPolicy = {
  highRiskThreshold: 70,
  requiredApprovals: 1,
  highRiskApprovals: 1,
  authorCanApprove: false,
  requireDistinctApprovers: true,
  specialistRoles: {
    SECURITY: "SECURITY_REVIEWER",
    PLATFORM: "PLATFORM_ENGINEER",
    DATABASE: "DATABASE_REVIEWER",
  },
};

export const personalApprovalPolicy: ApprovalPolicy = {
  ...defaultApprovalPolicy,
  authorCanApprove: true,
  requireDistinctApprovers: false,
};

export interface WorkspaceApprovalPolicy {
  maximumRiskScore: number;
  requiredApprovals: number;
  highRiskApprovals: number;
  authorCanApprove: boolean;
  requireDistinctApprovers: boolean;
  allowSourceCodeSharing: boolean;
}

export type WorkspaceKind = "PERSONAL" | "ORGANIZATION";

export function defaultWorkspaceApprovalPolicy(
  kind: WorkspaceKind,
): WorkspaceApprovalPolicy {
  return {
    maximumRiskScore: 80,
    requiredApprovals: 1,
    highRiskApprovals: 1,
    authorCanApprove: kind === "PERSONAL",
    requireDistinctApprovers: kind === "ORGANIZATION",
    allowSourceCodeSharing: false,
  };
}

export function validateWorkspaceApprovalPolicy(
  kind: WorkspaceKind,
  policy: WorkspaceApprovalPolicy,
): WorkspaceApprovalPolicy {
  if (!Number.isInteger(policy.maximumRiskScore) ||
      policy.maximumRiskScore < 0 ||
      policy.maximumRiskScore > 100) {
    throw new Error("Maximum risk score must be a whole number between 0 and 100.");
  }
  for (const [label, value] of [
    ["Low and medium required reviews", policy.requiredApprovals],
    ["High and critical required reviews", policy.highRiskApprovals],
  ] as const) {
    if (!Number.isInteger(value) || value < 1 || value > 10) {
      throw new Error(`${label} must be a whole number between 1 and 10.`);
    }
  }
  if (kind === "PERSONAL") {
    if (policy.requiredApprovals !== 1 || policy.highRiskApprovals !== 1) {
      throw new Error("Personal workspaces require exactly one review.");
    }
    if (!policy.authorCanApprove) {
      throw new Error("Campaign author approval must remain enabled in Personal workspaces.");
    }
    if (policy.requireDistinctApprovers) {
      throw new Error("Distinct approvers cannot be required in a Personal workspace.");
    }
  }
  return structuredClone(policy);
}

export function toApprovalPolicy(
  policy: WorkspaceApprovalPolicy,
): ApprovalPolicy {
  return {
    ...defaultApprovalPolicy,
    requiredApprovals: policy.requiredApprovals,
    highRiskApprovals: policy.highRiskApprovals,
    authorCanApprove: policy.authorCanApprove,
    requireDistinctApprovers: policy.requireDistinctApprovers,
  };
}

export function requiredApprovalsForRisk(
  request: Pick<ApprovalRequest, "riskScore">,
  policy: ApprovalPolicy,
): number {
  return request.riskScore >= policy.highRiskThreshold
    ? policy.highRiskApprovals
    : policy.requiredApprovals;
}

export function countValidApprovals(
  request: Pick<ApprovalRequest, "approvals">,
  policy: Pick<ApprovalPolicy, "requireDistinctApprovers">,
): number {
  return policy.requireDistinctApprovers
    ? new Set(request.approvals.map((approval) => approval.userId)).size
    : request.approvals.length;
}

export function recalculateApprovalRequest(
  request: ApprovalRequest,
  policy: ApprovalPolicy,
): ApprovalRequest {
  if (request.status === "REJECTED") return structuredClone(request);
  return {
    ...structuredClone(request),
    status: countValidApprovals(request, policy) >=
      requiredApprovalsForRisk(request, policy)
      ? "APPROVED"
      : "PENDING",
  };
}

export function approveRequest(
  request: ApprovalRequest,
  decision: { userId: string; roles: string[]; decidedAt?: string },
  policy: ApprovalPolicy = defaultApprovalPolicy,
): ApprovalRequest {
  if (request.status !== "PENDING") throw new Error("Approval request is no longer pending.");
  if (!request.validationPassed) throw new Error("Required validation must pass before approval.");
  if (!policy.authorCanApprove && request.authorId === decision.userId) {
    throw new Error("Authors cannot approve their own request.");
  }
  if (
    policy.requireDistinctApprovers &&
    request.approvals.some((item) => item.userId === decision.userId)
  ) {
    throw new Error("An approver can only approve once.");
  }
  if (!decision.roles.includes("APPROVER") && !decision.roles.includes("OWNER")) {
    throw new Error("The decision maker is not an approver.");
  }
  if (request.category !== "STANDARD") {
    const specialistRole = policy.specialistRoles[request.category];
    if (!decision.roles.includes(specialistRole) && !decision.roles.includes("OWNER")) {
      throw new Error(`${specialistRole} approval is required.`);
    }
  }
  const approvals = [
    ...request.approvals,
    { userId: decision.userId, decidedAt: decision.decidedAt ?? new Date().toISOString() },
  ];
  const required = requiredApprovalsForRisk(request, policy);
  return {
    ...request,
    approvals,
    status: countValidApprovals({ approvals }, policy) >= required
      ? "APPROVED"
      : "PENDING",
  };
}

export interface WorkspacePolicy {
  allowedRepositories: string[];
  allowedBranches: string[];
  protectedFiles: string[];
  maximumAffectedFiles: number;
  maximumRiskScore: number;
  requiredTests: string[];
  requiredReviewers: number;
  allowedRecipes: string[];
  allowedAiProviders: string[];
  allowSourceCodeSharing: boolean;
  retentionDays: number;
  blockVulnerabilities: boolean;
  allowedLicenses: string[];
  protectDatabaseFiles: boolean;
}

export interface PolicyEvaluationInput {
  repository: string;
  branch: string;
  affectedFiles: string[];
  riskScore: number;
  tests: string[];
  reviewerCount: number;
  recipe: string;
  aiProvider?: string;
  sharesSourceCode: boolean;
  vulnerabilities: number;
  licenses: string[];
}

export function evaluateWorkspacePolicy(
  policy: WorkspacePolicy,
  input: PolicyEvaluationInput,
): { allowed: boolean; violations: string[] } {
  const violations: string[] = [];
  if (!matchesAny(input.repository, policy.allowedRepositories)) violations.push("REPOSITORY_NOT_ALLOWED");
  if (!matchesAny(input.branch, policy.allowedBranches)) violations.push("BRANCH_NOT_ALLOWED");
  if (input.affectedFiles.length > policy.maximumAffectedFiles) violations.push("FILE_LIMIT_EXCEEDED");
  if (input.riskScore > policy.maximumRiskScore) violations.push("RISK_LIMIT_EXCEEDED");
  if (policy.requiredTests.some((test) => !input.tests.includes(test))) violations.push("REQUIRED_TEST_MISSING");
  if (input.reviewerCount < policy.requiredReviewers) violations.push("REVIEWER_COUNT_INSUFFICIENT");
  if (!policy.allowedRecipes.includes(input.recipe)) violations.push("RECIPE_NOT_ALLOWED");
  if (input.aiProvider && !policy.allowedAiProviders.includes(input.aiProvider)) violations.push("AI_PROVIDER_NOT_ALLOWED");
  if (input.sharesSourceCode && !policy.allowSourceCodeSharing) violations.push("SOURCE_SHARING_BLOCKED");
  if (input.vulnerabilities > 0 && policy.blockVulnerabilities) violations.push("VULNERABILITIES_BLOCKED");
  if (input.licenses.some((license) => !policy.allowedLicenses.includes(license))) violations.push("LICENSE_NOT_ALLOWED");
  if (input.affectedFiles.some((file) => matchesAny(file, policy.protectedFiles))) violations.push("PROTECTED_FILE");
  if (policy.protectDatabaseFiles && input.affectedFiles.some(isDatabaseFile)) violations.push("DATABASE_FILE_PROTECTED");
  return { allowed: violations.length === 0, violations };
}

function matchesAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`, "i").test(value);
  });
}

function isDatabaseFile(value: string): boolean {
  return /(^|\/)(migrations?|schema|database|db)(\/|\.|$)/i.test(value);
}
