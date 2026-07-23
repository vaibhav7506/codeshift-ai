import Link from "next/link";
import { Boxes, FileCode2, GitFork, Route } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { DotNetCompatibilityPanel } from "@/components/platform/DotNetCompatibilityPanel";
import { PageHeading } from "@/components/platform/PageHeading";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import {
  demoRepository,
  demoReport,
  dotNetDemoReport,
  dotNetDemoRepository,
} from "@/lib/platform-demo";

export default async function RepositoryDetailPage({
  params,
}: {
  params: Promise<{ repositoryId: string }>;
}) {
  const { repositoryId } = await params;
  const isDotNet = repositoryId === dotNetDemoRepository.id;
  const repository = isDotNet ? dotNetDemoRepository : demoRepository;
  const report = isDotNet ? dotNetDemoReport : demoReport;

  return (
    <AppShell
      title={repository.name}
      description="Repository intelligence, blockers, and recommended recipe order."
    >
      <div className="space-y-5">
        <PageHeading
          eyebrow={`Repository · ${repositoryId}`}
          title={repository.name}
          description="Analysis is read-only. Source contents remain outside AI providers unless explicit consent is granted."
          action={
            <Link href="/campaigns" className={buttonVariants({ size: "sm" })}>
              Create campaign
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={FileCode2} label="Source files" value={String(repository.files)} detail={isDotNet ? "C# project surface" : "JavaScript surface"} />
          <MetricCard icon={Boxes} label="Dependencies" value={isDotNet ? "7" : "18"} detail={isDotNet ? "NuGet + assemblies" : "3 runtime groups"} />
          <MetricCard icon={GitFork} label={isDotNet ? "Projects" : "Import edges"} value={isDotNet ? "1" : "47"} detail={isDotNet ? "Legacy MSBuild" : "Static + CommonJS"} />
          <MetricCard icon={Route} label="HTTP routes" value={isDotNet ? "1" : "3"} detail="Parity required" accent />
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Detected technologies</h3>
                <Badge tone="warning">Risk {repository.risk}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                ["Framework", repository.framework],
                ["Language", repository.language],
                ["Project model", isDotNet ? "Legacy MSBuild" : "CommonJS"],
                ["Runtime assumption", isDotNet ? ".NET SDK unavailable locally" : "Node.js version not declared"],
                ["Semantic analysis", isDotNet ? "Roslyn/MSBuild manifest" : "Static inventory"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                  <span className="text-text-muted">{label}</span>
                  <span className="font-medium text-text-primary">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader>
              <h3 className="text-sm font-semibold">Blockers and sequence</h3>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-text-secondary">
                {report.blockers.map((blocker) => (
                  <li key={blocker} className="rounded-lg border border-warning/20 bg-warning/5 p-3">
                    {blocker}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                  Recommended sequence
                </p>
                <p className="mt-2 text-sm font-semibold text-text-primary">
                  1. {report.sequence[0]}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        {isDotNet ? (
          <DotNetCompatibilityPanel compatibility={dotNetDemoReport.compatibility} />
        ) : null}
      </div>
    </AppShell>
  );
}
