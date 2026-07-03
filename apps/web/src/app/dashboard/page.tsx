import { AppShell } from "@/components/dashboard/AppShell";
import { CLIQuickstart } from "@/components/dashboard/CLIQuickstart";
import { MigrationStepper } from "@/components/dashboard/MigrationStepper";
import { RepositoryAnalyzer } from "@/components/dashboard/RepositoryAnalyzer";

export default function DashboardPage() {
  return (
    <AppShell
      title="Migration overview"
      description="Connect a repository and build a controlled migration run."
    >
      <div className="space-y-5">
        <MigrationStepper />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
          <RepositoryAnalyzer />
          <div>
            <CLIQuickstart />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
