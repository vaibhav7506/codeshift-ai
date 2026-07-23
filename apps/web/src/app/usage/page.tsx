import { Activity, Bot, Database, GitBranch, HardDrive, Timer } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeading } from "@/components/platform/PageHeading";
import { Card, CardContent } from "@/components/ui/Card";

const usage = [
  { label: "Analysed repositories", value: "2 / 25", detail: "8% of personal limit", icon: Database },
  { label: "Campaigns", value: "2 / 20", detail: "10% of personal limit", icon: GitBranch },
  { label: "Runner minutes", value: "0 / 1,000", detail: "No execution started", icon: Timer },
  { label: "AI tokens", value: "0 / 2M", detail: "BYOK usage remains optional", icon: Bot },
  { label: "Storage", value: "12 MB / 5 GB", detail: "Reports and evidence", icon: HardDrive },
  { label: "Generated reports", value: "3", detail: "Analysis and validation evidence", icon: Activity },
];

export default function UsagePage() {
  return (
    <AppShell title="Usage" description="Workspace metering, limits, and cost controls.">
      <div className="space-y-5">
        <PageHeading
          eyebrow="Metering"
          title="Usage overview"
          description="Transparent workspace usage with configurable limits. Billing is not enabled."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {usage.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="shadow-none">
                <CardContent>
                  <Icon className="size-4 text-primary" />
                  <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                    {item.label}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-text-primary">{item.value}</p>
                  <p className="mt-1 text-xs text-text-secondary">{item.detail}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
