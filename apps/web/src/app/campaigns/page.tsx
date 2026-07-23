import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { CampaignCreator } from "@/components/platform/CampaignCreator";
import { PageHeading } from "@/components/platform/PageHeading";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { demoCampaign, dotNetDemoCampaign } from "@/lib/platform-demo";

export default function CampaignsPage() {
  return (
    <AppShell
      title="Migration campaigns"
      description="Dependency-aware plans with explicit approval and rollback gates."
    >
      <div className="space-y-5">
        <PageHeading
          eyebrow="Campaign orchestration"
          title="Migration campaigns"
          description="Create a draft, review its scope and evidence, then approve execution through an isolated runner."
        />
        <CampaignCreator />
        {[demoCampaign, dotNetDemoCampaign].map((campaign) => (
        <Card key={campaign.id} className="shadow-none">
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">{campaign.status}</Badge>
                <Badge tone="warning">{campaign.risk} risk</Badge>
              </div>
              <h3 className="mt-3 font-semibold text-text-primary">
                {campaign.name}
              </h3>
              <p className="mt-1 text-xs text-text-secondary">
                {campaign.repository} · {campaign.affectedFiles} estimated files
              </p>
            </div>
            <Link
              href={`/campaigns/${campaign.id}`}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Review plan
              <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
        ))}
      </div>
    </AppShell>
  );
}
