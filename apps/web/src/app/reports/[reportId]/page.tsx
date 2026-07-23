import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeading } from "@/components/platform/PageHeading";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { demoReport } from "@/lib/platform-demo";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;

  return (
    <AppShell
      title={demoReport.title}
      description="Structured repository intelligence and explainable migration risk."
    >
      <div className="space-y-5">
        <PageHeading
          eyebrow={`Report · ${reportId}`}
          title={demoReport.title}
          description={`${demoReport.repository} · Generated ${demoReport.generatedAt}`}
          action={<Badge tone="success">Analysis complete</Badge>}
        />
        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="shadow-none">
            <CardHeader>
              <h3 className="text-sm font-semibold">Language breakdown</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              {demoReport.languageBreakdown.map((item) => (
                <div key={item.language}>
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">{item.language}</span>
                    <span className="font-mono text-text-muted">{item.value}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader>
              <h3 className="text-sm font-semibold">Inventory</h3>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Inventory label="Dependencies" values={demoReport.dependencies} />
              <Inventory label="Routes" values={demoReport.routes} />
              <Inventory label="Environment variables" values={demoReport.environmentVariables} />
              <Inventory label="Recipe order" values={demoReport.sequence} />
            </CardContent>
          </Card>
        </div>
        <Card className="shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Migration blockers</h3>
              <Badge tone="warning">{demoReport.blockers.length} review items</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {demoReport.blockers.map((blocker) => (
              <div key={blocker} className="rounded-lg border border-warning/20 bg-warning/5 p-4 text-sm text-text-secondary">
                {blocker}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Behavioural validation evidence</h3>
              <Badge tone="success">No regression detected</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {demoReport.behaviouralValidation.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-success/20 bg-success/5 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                  {label}
                </p>
                <p className="mt-2 text-sm font-semibold text-success">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Inventory({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
        {label}
      </p>
      <ul className="mt-3 space-y-2 text-xs text-text-secondary">
        {values.map((value) => <li key={value}>{value}</li>)}
      </ul>
    </div>
  );
}
