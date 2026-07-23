import { AppShell } from "@/components/dashboard/AppShell";
import { GovernanceOverview } from "@/components/platform/GovernanceOverview";
import { governancePages } from "@/lib/enterprise-demo";

export default function OrganizationPoliciesPage() {
  return (
    <AppShell title="Policies" description="Workspace execution and data governance guardrails.">
      <GovernanceOverview {...governancePages.policies} />
    </AppShell>
  );
}
