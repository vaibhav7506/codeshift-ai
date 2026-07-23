import { AppShell } from "@/components/dashboard/AppShell";
import { GovernanceOverview } from "@/components/platform/GovernanceOverview";
import { governancePages } from "@/lib/enterprise-demo";

export default function OrganizationPage() {
  return (
    <AppShell title="Organization" description="Tenant settings and workspace ownership.">
      <GovernanceOverview {...governancePages.organization} />
    </AppShell>
  );
}
