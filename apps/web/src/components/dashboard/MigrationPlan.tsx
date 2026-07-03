"use client";

import { useEffect, useState } from "react";
import type {
  AnalysisRiskLevel,
  MigrationPlan as MigrationPlanData,
} from "@codeshift/shared";
import {
  Check,
  CheckCircle2,
  Code2,
  FileStack,
  PencilLine,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";

export function MigrationPlan({
  plan,
  onEditScope,
}: {
  plan: MigrationPlanData;
  onEditScope: () => void;
}) {
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    setApproved(false);
  }, [plan.createdAt, plan.id]);

  return (
    <section id="migration-plan" className="scroll-mt-24" aria-labelledby="migration-plan-title">
      <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2
              id="migration-plan-title"
              className="text-sm font-semibold text-text-primary"
            >
              JavaScript → TypeScript migration plan
            </h2>
            <StatusPill tone={riskTone(plan.estimatedRisk)} dot>
              {plan.estimatedRisk}
            </StatusPill>
          </div>
          <p className="mt-1 font-mono text-[10px] text-text-muted">
            {plan.id} · {new Date(plan.createdAt).toLocaleString()}
          </p>
        </div>
        <Badge tone={approved ? "success" : "primary"}>
          {approved ? "Approved" : "Plan generated"}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <PlanMetric
          icon={Code2}
          label="Selected scope"
          value={plan.selectedScope}
          mono
        />
        <PlanMetric
          icon={ShieldCheck}
          label="Estimated risk"
          value={plan.estimatedRisk}
        />
        <PlanMetric
          icon={FileStack}
          label="Affected files"
          value={`~${plan.affectedFilesEstimate}`}
        />
      </div>

      <Card className="mt-3 overflow-hidden shadow-none">
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <div>
            <h3 className="text-xs font-semibold text-text-primary">
              Validation commands
            </h3>
            <p className="mt-0.5 text-[10px] text-text-muted">
              Included only when the repository analysis detected the script.
            </p>
          </div>
          <Badge>{plan.validationCommands.length}</Badge>
        </div>
        {plan.validationCommands.length > 0 ? (
          <div className="grid gap-2 p-4 sm:grid-cols-2">
            {plan.validationCommands.map((command) => (
              <div
                key={command}
                className="flex items-center gap-2 rounded-lg border border-[#1e293b] bg-code-background px-3 py-2.5 font-mono text-[10px] text-code-text"
              >
                <TerminalSquare className="size-3.5 shrink-0 text-[#2dd4bf]" />
                <code>{command}</code>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-4 py-5 text-xs text-text-muted">
            No test, build, lint, or typecheck script was detected.
          </p>
        )}
      </Card>

      <Card className="mt-3 overflow-hidden shadow-none">
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <div>
            <h3 className="text-xs font-semibold text-text-primary">
              Plan steps
            </h3>
            <p className="mt-0.5 text-[10px] text-text-muted">
              Approval does not execute these steps or modify repository files.
            </p>
          </div>
          <Badge>{plan.steps.length} steps</Badge>
        </div>
        <ol className="divide-y divide-border">
          {plan.steps.map((step, index) => (
            <li key={step.id} className="flex gap-3 px-4 py-3.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted font-mono text-[9px] font-semibold text-text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-text-primary">
                    {step.title}
                  </h4>
                  <StatusPill tone="neutral">
                    {step.status}
                  </StatusPill>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-text-muted">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card
        className={`mt-3 flex flex-col gap-4 p-4 shadow-none sm:flex-row sm:items-center sm:justify-between ${
          approved ? "border-success/30 bg-success/[0.04]" : ""
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
              approved
                ? "bg-success/10 text-success"
                : "bg-surface-muted text-text-secondary"
            }`}
          >
            {approved ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
          </span>
          <div>
            <p className="text-xs font-semibold text-text-primary">
              {approved ? "Plan approved for future execution" : "Human approval required"}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-text-muted">
              {approved
                ? "Approval is recorded in this browser only. No files have changed."
                : "Review the scope, risk, commands, and steps before approval."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onEditScope}>
            <PencilLine className="size-3.5" />
            Edit scope
          </Button>
          <Button
            size="sm"
            onClick={() => setApproved(true)}
            disabled={approved}
          >
            {approved ? <Check className="size-3.5" /> : null}
            {approved ? "Plan approved" : "Approve plan"}
          </Button>
        </div>
      </Card>
    </section>
  );
}

function PlanMetric({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: typeof Code2;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <Card className="p-4 shadow-none">
      <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-muted text-primary">
        <Icon className="size-3.5" />
      </div>
      <p
        className={`mt-4 truncate text-lg font-semibold tracking-tight text-text-primary ${
          mono ? "font-mono text-sm" : ""
        }`}
        title={value}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] font-medium text-text-muted">{label}</p>
    </Card>
  );
}

function riskTone(
  risk: AnalysisRiskLevel,
): "success" | "warning" | "danger" {
  if (risk === "LOW") return "success";
  if (risk === "MEDIUM") return "warning";
  return "danger";
}
