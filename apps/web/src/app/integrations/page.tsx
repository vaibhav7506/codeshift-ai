import { AppShell } from "@/components/dashboard/AppShell";
import { GovernanceOverview } from "@/components/platform/GovernanceOverview";
import { governancePages } from "@/lib/enterprise-demo";

export default function IntegrationsPage() {
  return (
    <AppShell title="Integrations" description="Source-control installations and webhook health.">
      <GovernanceOverview {...governancePages.integrations} />
    </AppShell>
  );
}
