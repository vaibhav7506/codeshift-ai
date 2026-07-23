import { AppShell } from "@/components/dashboard/AppShell";
import { GovernanceOverview } from "@/components/platform/GovernanceOverview";
import { governancePages } from "@/lib/enterprise-demo";

export default function OrganizationMembersPage() {
  return (
    <AppShell title="Members" description="Membership, invitations, and role assignments.">
      <GovernanceOverview {...governancePages.members} />
    </AppShell>
  );
}
