import { AppShell } from "@/components/dashboard/AppShell";
import { WorkspacePolicyEditor } from "@/components/platform/WorkspacePolicyEditor";

export default function OrganizationPoliciesPage() {
  return (
    <AppShell title="Policies" description="Workspace execution and data governance guardrails.">
      <WorkspacePolicyEditor />
    </AppShell>
  );
}
