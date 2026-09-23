import { CheckCircle2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import type { GovernanceMetric } from "@/lib/enterprise-demo";
import { PageHeading } from "./PageHeading";

export function GovernanceOverview({
  eyebrow,
  title,
  description,
  metrics,
  controls,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  metrics: GovernanceMetric[];
  controls: string[];
  action?: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={action}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label} className="shadow-none">
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                  {metric.label}
                </p>
                {metric.tone && <Badge tone={metric.tone}>{metric.tone}</Badge>}
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-tight text-text-primary">
                {metric.value}
              </p>
              <p className="mt-1 text-xs text-text-secondary">{metric.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-none">
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Enforced controls</h3>
              <p className="mt-0.5 text-xs text-text-muted">Applied at the server boundary.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {controls.map((control) => (
              <div key={control} className="flex gap-2 rounded-lg border border-border bg-background p-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                <span className="text-xs leading-5 text-text-secondary">{control}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
