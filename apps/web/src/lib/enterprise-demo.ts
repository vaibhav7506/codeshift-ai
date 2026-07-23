export interface GovernanceMetric {
  label: string;
  value: string;
  detail: string;
  tone?: "success" | "warning" | "info";
}

export const governancePages = {
  organization: {
    eyebrow: "Tenant boundary",
    title: "Personal organization",
    description: "A compatible personal workspace with enterprise-grade isolation and upgrade paths.",
    metrics: [
      { label: "Workspaces", value: "1", detail: "Personal workspace", tone: "success" },
      { label: "Members", value: "1", detail: "Active owner", tone: "info" },
      { label: "Retention", value: "30 days", detail: "Workspace policy" },
    ],
    controls: ["Workspace-scoped repository ownership", "Organization and workspace settings", "Strict tenant keys on governed resources"],
  },
  members: {
    eyebrow: "Identity and access",
    title: "Members and roles",
    description: "Memberships, invitations, and server-enforced permissions for every sensitive action.",
    metrics: [
      { label: "Active members", value: "1", detail: "personal-user", tone: "success" },
      { label: "Pending invites", value: "0", detail: "No outstanding invitations" },
      { label: "Assigned role", value: "Owner", detail: "Full workspace authority", tone: "info" },
    ],
    controls: ["Nine predefined enterprise roles", "Suspension and invitation lifecycle", "Server-side authorization on protected APIs"],
  },
  policies: {
    eyebrow: "Policy engine",
    title: "Workspace policies",
    description: "Fail-closed guardrails evaluated before execution and pull request creation.",
    metrics: [
      { label: "Max risk", value: "80", detail: "Higher scores are blocked", tone: "warning" },
      { label: "Required reviews", value: "2", detail: "For high-risk campaigns" },
      { label: "Source sharing", value: "Blocked", detail: "Explicit consent required", tone: "success" },
    ],
    controls: ["Repository, branch, recipe, and AI allowlists", "Protected files, database files, and change-size limits", "Required tests, reviewers, vulnerability and license checks"],
  },
  runners: {
    eyebrow: "Isolated execution",
    title: "Self-hosted runners",
    description: "Short-lived identities and least-privilege job execution with immediate revocation.",
    metrics: [
      { label: "Online", value: "1", detail: "runner-linux-01", tone: "success" },
      { label: "Capacity", value: "2 jobs", detail: "Node 20 · .NET 8" },
      { label: "Credential TTL", value: "60 min", detail: "Automatically expires", tone: "info" },
    ],
    controls: ["Single-use 10-minute pairing tokens", "CPU, memory, timeout, and network limits", "Sanitized logs, cleanup, and no persisted repositories"],
  },
  integrations: {
    eyebrow: "Source control",
    title: "Integrations",
    description: "GitHub-first automation behind an extensible source-control provider contract.",
    metrics: [
      { label: "Provider", value: "GitHub", detail: "Installation scoped", tone: "success" },
      { label: "Repositories", value: "1", detail: "Explicitly granted" },
      { label: "Webhook", value: "Verified", detail: "HMAC SHA-256", tone: "info" },
    ],
    controls: ["Branch, commit, pull request, check, and comment operations", "Tracked external IDs and direct links", "Webhook verification and installation-token rotation"],
  },
  audit: {
    eyebrow: "Accountability",
    title: "Audit trail",
    description: "Append-only, tenant-scoped evidence for sensitive changes and decisions.",
    metrics: [
      { label: "Integrity", value: "Verified", detail: "SHA-256 hash chain", tone: "success" },
      { label: "Events", value: "12", detail: "Current workspace" },
      { label: "Sensitive data", value: "Redacted", detail: "Secrets and source omitted", tone: "info" },
    ],
    controls: ["Actor, action, resource, request, session, result, and timestamp", "Previous and next metadata without source content", "Failure reasons captured without credential leakage"],
  },
} satisfies Record<string, {
  eyebrow: string;
  title: string;
  description: string;
  metrics: GovernanceMetric[];
  controls: string[];
}>;
