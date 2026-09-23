import Link from "next/link";
import { Check, Circle, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeading } from "@/components/platform/PageHeading";
import { DotNetCompatibilityPanel } from "@/components/platform/DotNetCompatibilityPanel";
import { RichDiffReview } from "@/components/platform/RichDiffReview";
import { CampaignApprovalButton } from "@/components/platform/CampaignApprovalButton";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import {
  demoCampaign,
  dotNetDemoCampaign,
  dotNetDemoReport,
} from "@/lib/platform-demo";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const isDotNet = campaignId === dotNetDemoCampaign.id;
  const campaign = isDotNet ? dotNetDemoCampaign : demoCampaign;

  return (
    <AppShell
      title={campaign.name}
      description="Scope, dependencies, approval state, validation, and rollback."
    >
      <div className="space-y-5">
        <PageHeading
          eyebrow={`Campaign · ${campaignId}`}
          title={campaign.name}
          description="No transformation can start until the approved scope, checkpoint policy, and validation contract are accepted."
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                <RotateCcw className="size-4" />
                Roll back
              </Button>
              <CampaignApprovalButton campaignId={campaignId} />
            </div>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Current stage", campaign.status],
            ["Risk", `${campaign.riskScore}/100 · ${campaign.risk}`],
            ["Scope", campaign.scope.join(", ")],
            ["Changed files", String(campaign.affectedFiles)],
            ["Recipe", `${campaign.recipe} · ${campaign.version}`],
            ["Validation", campaign.validationStatus],
            ["Approval", campaign.approvalStatus],
            ["Runner", campaign.runnerStatus],
            ["Cost", campaign.cost],
            ["Duration", campaign.duration],
            ["Checkpoint", campaign.checkpoint],
            ["PR status", campaign.prStatus],
          ].map(([label, value]) => (
            <Card key={label} className="p-4 shadow-none">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                {label}
              </p>
              <p className="mt-2 text-sm font-semibold text-text-primary">{value}</p>
            </Card>
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Explainable risk map</h3>
                <Badge tone="warning">{campaign.riskScore}/100</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {campaign.riskFactors.map((factor) => (
                <div key={factor.label}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-text-primary">{factor.label}</span>
                    <span className="font-mono text-text-muted">+{factor.score}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-4">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-warning"
                        style={{ width: `${Math.min(100, factor.score * 4)}%` }}
                      />
                    </div>
                    <span className="w-40 text-right text-[10px] text-text-muted">
                      {factor.detail}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader>
              <h3 className="text-sm font-semibold">Validation contract</h3>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {Object.entries(campaign.validationSummary).map(([label, value]) => (
                <div key={label} className="rounded-lg border border-success/20 bg-success/5 p-3">
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted">
                    {label.replace(/([A-Z])/g, " $1")}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-success">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        {isDotNet ? (
          <DotNetCompatibilityPanel compatibility={dotNetDemoReport.compatibility} />
        ) : null}
        <RichDiffReview change={campaign.fileChange} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card className="shadow-none">
            <CardHeader>
              <h3 className="text-sm font-semibold">Execution stages</h3>
            </CardHeader>
            <CardContent className="space-y-1">
              {campaign.stages.map((stage, index) => {
                const completed = stage.status === "COMPLETED";
                return (
                  <div key={stage.name} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                    <div className={`flex size-7 items-center justify-center rounded-full border ${completed ? "border-success/30 bg-success/10 text-success" : "border-border bg-surface-muted text-text-muted"}`}>
                      {completed ? <Check className="size-3.5" /> : <Circle className="size-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        {index + 1}. {stage.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-text-muted">
                        {stage.status}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <div className="space-y-5">
            <Card className="shadow-none">
              <CardHeader>
                <h3 className="text-sm font-semibold">Approved boundaries</h3>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <Boundary label="Scope" values={campaign.scope} />
                <Boundary label="Protected" values={campaign.protectedFiles} />
                <Boundary label="Validation" values={campaign.validations} />
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Checkpoint</span>
                  <Badge>{campaign.checkpoint}</Badge>
                </div>
                <p className="mt-3 text-sm text-text-secondary">
                  A commit, file hashes, lockfile hashes, configuration, and validation baseline will be captured before execution.
                </p>
                <Link
                  href={isDotNet ? "/reports/phase-3-dotnet-validation" : "/reports/phase-2-validation"}
                  className={buttonVariants({ variant: "ghost", size: "sm", className: "mt-3 px-0" })}
                >
                  View analysis report
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Boundary({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <Badge key={value}>{value}</Badge>
        ))}
      </div>
    </div>
  );
}
