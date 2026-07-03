import {
  Binoculars,
  ClipboardList,
  FileDiff,
  GitPullRequestArrow,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";

const steps = [
  {
    label: "Analyze",
    detail: "Map repository shape, dependencies, and migration risk.",
    icon: Binoculars,
  },
  {
    label: "Plan",
    detail: "Turn findings into a scoped, ordered migration plan.",
    icon: ClipboardList,
  },
  {
    label: "Patch",
    detail: "Apply small transformations with inspectable diffs.",
    icon: FileDiff,
  },
  {
    label: "Validate",
    detail: "Run tests, typecheck, lint, and project-specific gates.",
    icon: ShieldCheck,
  },
  {
    label: "PR",
    detail: "Package approved work into a clean pull request.",
    icon: GitPullRequestArrow,
  },
];

export function WorkflowSection() {
  return (
    <section
      id="workflow"
      className="scroll-mt-16 border-b border-border bg-surface"
    >
      <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 lg:py-28">
        <div className="max-w-2xl">
          <Badge>Controlled workflow</Badge>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
            From repository to pull request, with a gate at every step.
          </h2>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            CodeShift AI keeps migration work narrow, observable, and easy to
            reverse. Each stage produces an artifact your team can inspect.
          </p>
        </div>

        <div className="relative mt-12 grid gap-3 md:grid-cols-5">
          <div className="absolute left-[10%] right-[10%] top-7 hidden h-px bg-border md:block" />
          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <div
                key={step.label}
                className="relative rounded-[12px] border border-border bg-background p-4 md:border-0 md:bg-transparent md:p-0"
              >
                <div className="relative z-10 flex size-14 items-center justify-center rounded-[12px] border border-border bg-surface text-primary shadow-sm">
                  <Icon aria-hidden="true" className="size-5" />
                </div>
                <div className="mt-5 flex items-center gap-2">
                  <span className="font-mono text-[10px] font-semibold text-text-muted">
                    0{index + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {step.label}
                  </h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-text-secondary">
                  {step.detail}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
