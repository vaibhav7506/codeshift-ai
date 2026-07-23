import Link from "next/link";
import { ArrowRight, GitBranch, Search } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeading } from "@/components/platform/PageHeading";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { demoRepository, dotNetDemoRepository } from "@/lib/platform-demo";

export default function RepositoriesPage() {
  return (
    <AppShell
      title="Repositories"
      description="Connected repositories and structured modernization readiness."
    >
      <div className="space-y-5">
        <PageHeading
          eyebrow="Repository intelligence"
          title="Repositories"
          description="Select a repository to review detected technologies, migration risks, and recommended recipe order."
          action={
            <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
              Analyze repository
            </Link>
          }
        />
        <Card className="shadow-none">
          <CardContent>
            <label className="relative block max-w-md">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-text-muted" />
              <Input className="pl-9" placeholder="Filter repositories" />
            </label>
          </CardContent>
        </Card>
        <Card className="overflow-hidden shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-surface-muted/60 font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                <tr>
                  <th className="px-5 py-3">Repository</th>
                  <th className="px-5 py-3">Technology</th>
                  <th className="px-5 py-3">Readiness</th>
                  <th className="px-5 py-3">Risk</th>
                  <th className="px-5 py-3">Analysis</th>
                  <th className="px-5 py-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {[demoRepository, dotNetDemoRepository].map((repository) => (
                <tr key={repository.id}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-muted text-text-secondary">
                        <GitBranch className="size-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-text-primary">
                          {repository.name}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-text-muted">
                          {repository.owner} / {repository.defaultBranch}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-text-secondary">
                    {repository.framework} · {repository.language}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-text-secondary">
                    {repository.readiness}/100
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone="warning">{repository.risk}</Badge>
                  </td>
                  <td className="px-5 py-4 text-xs text-text-muted">
                    {repository.lastAnalysis}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/repositories/${repository.id}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Review
                      <ArrowRight className="size-4" />
                    </Link>
                  </td>
                </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
