import { AppShell } from "@/components/dashboard/AppShell";
import { GovernanceOverview } from "@/components/platform/GovernanceOverview";
import { governancePages } from "@/lib/enterprise-demo";

export default function AuditPage() {
  return (
    <AppShell title="Audit" description="Append-only evidence for governed workspace activity.">
      <GovernanceOverview {...governancePages.audit} />
    </AppShell>
  );
}
