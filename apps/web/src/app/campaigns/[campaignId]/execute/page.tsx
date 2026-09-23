import { AppShell } from "@/components/dashboard/AppShell";
import { ExecutionGuide } from "@/components/platform/ExecutionGuide";

export default async function CampaignExecutionPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  return (
    <AppShell
      title="Campaign execution"
      description="Approved CLI and runner handoff with validation and rollback guidance."
    >
      <ExecutionGuide campaignId={campaignId} />
    </AppShell>
  );
}
