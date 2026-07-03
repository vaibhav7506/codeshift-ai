import {
  Binoculars,
  ClipboardList,
  CodeXml,
  GitPullRequestArrow,
  GitBranch,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/ui/Card";

const steps = [
  { label: "Repo", icon: GitBranch },
  { label: "Analysis", icon: Binoculars },
  { label: "Plan", icon: ClipboardList },
  { label: "Patch", icon: CodeXml },
  { label: "Validate", icon: ShieldCheck },
  { label: "Review", icon: SearchCheck },
  { label: "PR", icon: GitPullRequestArrow },
];

export function MigrationStepper() {
  return (
    <Card className="overflow-hidden p-4 shadow-none sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Migration workflow
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Start with a repository. Every later stage requires approval.
          </p>
        </div>
        <span className="hidden font-mono text-[9px] font-semibold uppercase tracking-wider text-text-muted sm:block">
          0 / 7 complete
        </span>
      </div>

      <div className="code-scroll overflow-x-auto pb-1">
        <div className="relative flex min-w-[670px] items-start justify-between">
          <div className="absolute left-8 right-8 top-4 h-px bg-border" />
          {steps.map((step, index) => {
            const Icon = step.icon;
            const active = index === 0;
            return (
              <div
                key={step.label}
                className="relative z-10 flex w-[82px] flex-col items-center"
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-lg border ${
                    active
                      ? "border-primary bg-primary text-white dark:text-[#051411]"
                      : "border-border bg-surface text-text-muted"
                  }`}
                >
                  <Icon className="size-3.5" />
                </span>
                <span
                  className={`mt-2 text-[10px] font-semibold ${
                    active ? "text-primary" : "text-text-muted"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
