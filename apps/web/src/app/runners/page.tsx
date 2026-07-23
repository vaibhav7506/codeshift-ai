import { AppShell } from "@/components/dashboard/AppShell";
import { GovernanceOverview } from "@/components/platform/GovernanceOverview";
import { governancePages } from "@/lib/enterprise-demo";

export default function RunnersPage() {
  return (
    <AppShell title="Runners" description="Registration, health, capacity, and revocation.">
      <GovernanceOverview {...governancePages.runners} />
    </AppShell>
  );
}
