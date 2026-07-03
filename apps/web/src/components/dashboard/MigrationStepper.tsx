import {
  Binoculars,
  Check,
  CircleAlert,
  ClipboardList,
  CodeXml,
  GitBranch,
  GitPullRequestArrow,
  LoaderCircle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export type MigrationStepStatus =
  | "pending"
  | "active"
  | "running"
  | "complete"
  | "error"
  | "cli-only";

export type DashboardWorkflowPhase =
  | "IDLE"
  | "ANALYZING"
  | "ANALYZED"
  | "PLANNING"
  | "PLAN_READY"
  | "ERROR";

export type DashboardFailedStep = "analysis" | "plan";

export type DashboardWorkflowState =
  | {
      phase: Exclude<DashboardWorkflowPhase, "ERROR">;
      failedStep?: never;
    }
  | {
      phase: "ERROR";
      failedStep: DashboardFailedStep;
    };

type StepId = "repo" | "analysis" | "plan" | "patch" | "validate" | "pr";

interface MigrationStepDefinition {
  id: StepId;
  label: string;
  icon: LucideIcon;
}

const steps: MigrationStepDefinition[] = [
  { id: "repo", label: "Repo", icon: GitBranch },
  { id: "analysis", label: "Analyze", icon: Binoculars },
  { id: "plan", label: "Plan", icon: ClipboardList },
  { id: "patch", label: "Patch", icon: CodeXml },
  { id: "validate", label: "Validate", icon: ShieldCheck },
  { id: "pr", label: "PR", icon: GitPullRequestArrow },
];

const statusStyles: Record<MigrationStepStatus, string> = {
  pending: "border-border bg-surface text-text-muted",
  active:
    "border-primary/60 bg-primary/10 text-primary ring-2 ring-primary/10",
  running:
    "border-primary/60 bg-primary/10 text-primary ring-2 ring-primary/15",
  complete: "border-success/35 bg-success/10 text-success",
  error: "border-danger/40 bg-danger/10 text-danger",
  "cli-only": "border-border bg-surface-muted text-text-secondary",
};

export function MigrationStepper({
  workflow,
}: {
  workflow: DashboardWorkflowState;
}) {
  const resolvedSteps = steps.map((step) => ({
    ...step,
    status: resolveStepStatus(step.id, workflow),
  }));
  const completedSteps = resolvedSteps.filter(
    (step) => step.status === "complete",
  ).length;

  return (
    <Card className="overflow-hidden p-4 shadow-none sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Migration workflow
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Analyze and plan here. Apply and validate changes with the local CLI.
          </p>
        </div>
        <span className="hidden font-mono text-[9px] font-semibold uppercase tracking-wider text-text-muted sm:block">
          {completedSteps} / {steps.length} complete
        </span>
      </div>

      <div className="code-scroll overflow-x-auto pb-1">
        <div className="relative flex min-w-[570px] items-start justify-between">
          <div className="absolute left-8 right-8 top-4 h-px bg-border" />
          {resolvedSteps.map((step) => (
            <MigrationStep key={step.id} {...step} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function MigrationStep({
  label,
  icon: Icon,
  status,
}: MigrationStepDefinition & { status: MigrationStepStatus }) {
  const StatusIcon =
    status === "complete"
      ? Check
      : status === "running"
        ? LoaderCircle
        : status === "error"
          ? CircleAlert
          : Icon;
  const emphasized =
    status === "active" || status === "running" || status === "error";

  return (
    <div
      className="relative z-10 flex w-[82px] flex-col items-center"
      aria-current={
        status === "active" || status === "running" ? "step" : undefined
      }
    >
      <span
        className={`relative flex size-8 items-center justify-center rounded-lg border transition-colors duration-200 ${statusStyles[status]}`}
      >
        {status === "active" ? (
          <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary motion-safe:animate-pulse" />
        ) : null}
        <StatusIcon
          className={`size-3.5 ${
            status === "running" ? "motion-safe:animate-spin" : ""
          }`}
        />
      </span>
      <span
        className={`mt-2 text-[10px] font-semibold transition-colors ${
          emphasized
            ? status === "error"
              ? "text-danger"
              : "text-primary"
            : status === "complete"
              ? "text-success"
              : "text-text-muted"
        }`}
      >
        {label}
      </span>
      {status === "cli-only" ? (
        <Badge className="mt-1 h-4 px-1.5 text-[8px] tracking-[0.08em]">
          CLI
        </Badge>
      ) : null}
      {status === "error" ? (
        <Badge
          tone="danger"
          className="mt-1 h-4 px-1.5 text-[8px] tracking-[0.08em]"
        >
          Error
        </Badge>
      ) : null}
      {status === "running" ? (
        <span className="mt-1 font-mono text-[8px] font-semibold uppercase tracking-wider text-primary motion-safe:animate-pulse">
          Running
        </span>
      ) : null}
    </div>
  );
}

function resolveStepStatus(
  step: StepId,
  workflow: DashboardWorkflowState,
): MigrationStepStatus {
  if (workflow.phase === "ERROR") {
    if (workflow.failedStep === "analysis") {
      if (step === "repo") return "complete";
      if (step === "analysis") return "error";
      return "pending";
    }

    if (step === "repo" || step === "analysis") return "complete";
    if (step === "plan") return "error";
    return "pending";
  }

  switch (workflow.phase) {
    case "IDLE":
      return step === "repo" ? "active" : "pending";
    case "ANALYZING":
      if (step === "repo") return "complete";
      return step === "analysis" ? "running" : "pending";
    case "ANALYZED":
      if (step === "repo" || step === "analysis") return "complete";
      return step === "plan" ? "active" : "pending";
    case "PLANNING":
      if (step === "repo" || step === "analysis") return "complete";
      return step === "plan" ? "running" : "pending";
    case "PLAN_READY":
      if (step === "repo" || step === "analysis" || step === "plan") {
        return "complete";
      }
      return "cli-only";
  }
}
