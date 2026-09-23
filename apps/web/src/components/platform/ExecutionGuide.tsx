"use client";

import { useEffect, useState } from "react";
import type {
  CampaignExecutionGuide,
  ExecutionPlatform,
  ExecutionStep,
} from "@codeshift/shared";
import { CheckCircle2, Clipboard, RefreshCw, TerminalSquare } from "lucide-react";
import { PageHeading } from "@/components/platform/PageHeading";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

interface CampaignSummary {
  name: string;
  repository: string;
  approvedScope: string[];
  status: string;
  targetBranch: string;
  runnerStatus: string;
}

export function ExecutionGuide({ campaignId }: { campaignId: string }) {
  const [platform, setPlatform] = useState<ExecutionPlatform>("windows-powershell");
  const [guide, setGuide] = useState<CampaignExecutionGuide | null>(null);
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGuide(null);
    setError(null);
    void fetch(
      `/api/campaigns/${encodeURIComponent(campaignId)}/execution-guide?platform=${platform}`,
    )
      .then(async (response) => {
        const body = (await response.json()) as {
          guide?: CampaignExecutionGuide;
          campaign?: CampaignSummary;
          error?: { message?: string };
        };
        if (!response.ok || !body.guide || !body.campaign) {
          throw new Error(body.error?.message ?? "The execution guide could not be loaded.");
        }
        setGuide(body.guide);
        setCampaign(body.campaign);
      })
      .catch((caughtError: unknown) =>
        setError(caughtError instanceof Error ? caughtError.message : "The execution guide could not be loaded."),
      );
  }, [campaignId, platform]);

  if (error) {
    return <Card className="shadow-none"><CardContent><p role="alert" className="text-sm text-danger">{error}</p></CardContent></Card>;
  }
  if (!guide || !campaign) {
    return <Card className="shadow-none"><CardContent><p className="text-sm text-text-secondary">Loading approved execution guide…</p></CardContent></Card>;
  }

  const withToken = (command: string) =>
    token ? command.replace("<temporary-token>", token) : command;

  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow={`Approved campaign · ${campaignId}`}
        title={campaign.name}
        description="Follow the commands in order. No command is generated outside the registered CLI manifest."
      />
      {new URLSearchParams(globalThis.location?.search ?? "").get("approved") === "1" ? (
        <Card className="border-success/30 bg-success/[0.04] shadow-none">
          <CardContent className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" />
            Approval saved. The campaign is ready for execution.
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Repository", campaign.repository],
          ["Selected recipe", guide.recipeName],
          ["Approved scope", campaign.approvedScope.join(", ")],
          ["Status", campaign.status],
          ["Target branch", campaign.targetBranch],
          ["Runner", campaign.runnerStatus],
        ].map(([label, value]) => (
          <Card key={label} className="p-4 shadow-none">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">{label}</p>
            <p className="mt-2 break-words text-sm font-semibold text-text-primary">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Manual CLI execution</h3>
              <p className="mt-1 text-xs text-text-muted">No online runner is connected, so use the approved local workflow.</p>
            </div>
            <div className="flex rounded-lg border border-border p-1">
              <PlatformButton active={platform === "windows-powershell"} onClick={() => setPlatform("windows-powershell")}>
                Windows PowerShell
              </PlatformButton>
              <PlatformButton active={platform === "macos-linux"} onClick={() => setPlatform("macos-linux")}>
                macOS / Linux
              </PlatformButton>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-surface-muted p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-text-primary">Short-lived campaign token</p>
                <p className="mt-1 text-[10px] text-text-muted">
                  {tokenExpiresAt ? `Expires ${new Date(tokenExpiresAt).toLocaleString()}` : "Generate immediately before connecting the CLI."}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const response = await fetch(
                    `/api/campaigns/${encodeURIComponent(campaignId)}/execution-token`,
                    { method: "POST", headers: { "x-codeshift-csrf": "1" } },
                  );
                  const body = (await response.json()) as { token?: string; expiresAt?: string; error?: { message?: string } };
                  if (!response.ok || !body.token || !body.expiresAt) {
                    setError(body.error?.message ?? "A token could not be generated.");
                    return;
                  }
                  setToken(body.token);
                  setTokenExpiresAt(body.expiresAt);
                }}
              >
                <RefreshCw className="size-3.5" />
                {token ? "Regenerate token" : "Generate token"}
              </Button>
            </div>
          </div>
          <GuideSteps steps={guide.steps} transform={withToken} />
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <GuideSection title="Validation" steps={guide.validationSteps} transform={withToken} />
        <GuideSection title="Rollback" steps={guide.rollbackSteps} transform={withToken} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader><h3 className="text-sm font-semibold">Prerequisites and expected changes</h3></CardHeader>
          <CardContent className="space-y-3 text-xs text-text-secondary">
            {guide.prerequisites.map((item) => <p key={item.id}><strong>{item.title}:</strong> {item.description}</p>)}
            <div className="flex flex-wrap gap-2">{guide.expectedChangedFiles.map((file) => <Badge key={file}>{file}</Badge>)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader><h3 className="text-sm font-semibold">Troubleshooting and next action</h3></CardHeader>
          <CardContent className="space-y-2 text-xs text-text-secondary">
            {guide.troubleshooting.map((item) => <p key={item}>• {item}</p>)}
            <p className="pt-2 font-medium text-text-primary">{guide.nextActions[0]?.title}: {guide.nextActions[0]?.description}</p>
          </CardContent>
        </Card>
      </div>
      <Card className="shadow-none">
        <CardHeader><h3 className="text-sm font-semibold">Execution progress</h3></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {["Queued", "Preparing workspace", "Running preflight", "Creating checkpoint", "Executing recipe", "Building", "Running tests", "Running recipe validation", "Producing report", "Awaiting review", "Ready for pull request", "Completed", "Failed", "Rolled back"].map((stage) => <Badge key={stage}>{stage}</Badge>)}
        </CardContent>
      </Card>
    </div>
  );
}

function PlatformButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-md px-3 py-1.5 text-xs ${active ? "bg-primary text-white" : "text-text-secondary"}`}>{children}</button>;
}

function GuideSection({ title, steps, transform }: { title: string; steps: ExecutionStep[]; transform: (command: string) => string }) {
  return <Card className="shadow-none"><CardHeader><h3 className="text-sm font-semibold">{title}</h3></CardHeader><CardContent><GuideSteps steps={steps} transform={transform} /></CardContent></Card>;
}

function GuideSteps({ steps, transform }: { steps: ExecutionStep[]; transform: (command: string) => string }) {
  return (
    <ol className="space-y-3">
      {steps.map((step) => {
        const command = transform(step.command);
        return (
          <li key={step.id} className="rounded-lg border border-border p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted font-mono text-[10px]">{step.order}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-text-primary">{step.title}</p>
                <p className="mt-1 text-[10px] text-text-muted">{step.description}</p>
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-code-background p-3 text-code-text">
                  <TerminalSquare className="mt-0.5 size-3.5 shrink-0 text-[#2dd4bf]" />
                  <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-[10px]">{command}</code>
                  <button type="button" aria-label={`Copy ${step.title}`} onClick={() => void navigator.clipboard.writeText(command)}>
                    <Clipboard className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
