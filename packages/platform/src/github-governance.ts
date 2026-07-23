import type { ApprovalRequest } from "./approval-policy.js";

export interface SourceControlProvider {
  createBranch(input: { repository: string; branch: string; baseSha: string }): Promise<{ sha: string }>;
  createCommit(input: { repository: string; branch: string; message: string }): Promise<{ sha: string }>;
  createPullRequest(input: { repository: string; branch: string; base: string; title: string }): Promise<{ id: string; url: string }>;
  publishCheck(input: { repository: string; sha: string; conclusion: "success" | "failure"; summary: string }): Promise<void>;
  publishComment(input: { repository: string; pullRequestId: string; body: string }): Promise<void>;
}

export interface PullRequestGateInput {
  approval: ApprovalRequest;
  policyAllowed: boolean;
  validationPassed: boolean;
}

export function assertPullRequestGate(input: PullRequestGateInput): void {
  if (input.approval.status !== "APPROVED") {
    throw new Error("Pull request creation requires completed approval.");
  }
  if (!input.validationPassed || !input.approval.validationPassed) {
    throw new Error("Pull request creation requires successful validation.");
  }
  if (!input.policyAllowed) throw new Error("Pull request creation is blocked by workspace policy.");
}

export interface GitHubInstallation {
  organizationId: string;
  workspaceId: string;
  installationId: string;
  repositories: string[];
  webhookSecretVersion: number;
  tokenExpiresAt: string;
}

export function rotateGitHubInstallationToken(
  installation: GitHubInstallation,
  expiresAt: string,
): GitHubInstallation {
  return {
    ...installation,
    webhookSecretVersion: installation.webhookSecretVersion + 1,
    tokenExpiresAt: expiresAt,
  };
}
