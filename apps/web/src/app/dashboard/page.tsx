import { AppShell } from "@/components/dashboard/AppShell";
import { DashboardWorkflow } from "@/components/dashboard/DashboardWorkflow";

export default function DashboardPage() {
  return (
    <AppShell
      title="Migration overview"
      description="Connect a repository and build a controlled migration run."
    >
      <DashboardWorkflow />
    </AppShell>
  );
}
