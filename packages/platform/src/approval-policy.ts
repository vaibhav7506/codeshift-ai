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
  specialistRoles: Record<Exclude<ApprovalCategory, "STANDARD">, string>;
}

export const defaultApprovalPolicy: ApprovalPolicy = {
  highRiskThreshold: 70,
  requiredApprovals: 1,
  highRiskApprovals: 2,
  specialistRoles: {
    SECURITY: "SECURITY_REVIEWER",
    PLATFORM: "PLATFORM_ENGINEER",
    DATABASE: "DATABASE_REVIEWER",
  },
};

export function approveRequest(
  request: ApprovalRequest,
  decision: { userId: string; roles: string[]; decidedAt?: string },
  policy: ApprovalPolicy = defaultApprovalPolicy,
): ApprovalRequest {
  if (request.status !== "PENDING") throw new Error("Approval request is no longer pending.");
  if (!request.validationPassed) throw new Error("Required validation must pass before approval.");
  if (request.authorId === decision.userId) throw new Error("Authors cannot approve their own request.");
  if (request.approvals.some((item) => item.userId === decision.userId)) {
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
  const required = request.riskScore >= policy.highRiskThreshold
    ? policy.highRiskApprovals
    : policy.requiredApprovals;
  return {
    ...request,
    approvals,
    status: approvals.length >= required ? "APPROVED" : "PENDING",
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
