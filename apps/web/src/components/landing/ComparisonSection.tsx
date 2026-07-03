import { Check, Minus, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

const comparisons = [
  {
    capability: "Repository-wide context",
    generic: "Prompt-dependent",
    codeshift: "Structured analysis",
    genericState: "partial",
  },
  {
    capability: "Migration scope controls",
    generic: "Manual prompting",
    codeshift: "Path and recipe bounded",
    genericState: "partial",
  },
  {
    capability: "Validation gates",
    generic: "Not guaranteed",
    codeshift: "Tests + typecheck",
    genericState: "no",
  },
  {
    capability: "Review artifact",
    generic: "Loose code output",
    codeshift: "Clean, focused diff",
    genericState: "no",
  },
  {
    capability: "Human approval",
    generic: "Workflow dependent",
    codeshift: "Required before PR",
    genericState: "partial",
  },
];

export function ComparisonSection() {
  return (
    <section
      id="comparison"
      className="scroll-mt-16 border-b border-border"
    >
      <div className="mx-auto max-w-[1060px] px-5 py-24 sm:px-8 lg:py-28">
        <div className="text-center">
          <Badge tone="warning">Built for migration work</Badge>
          <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
            Code generation is easy. Controlled change is the hard part.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-text-secondary">
            CodeShift AI is designed around reviewable migration outcomes—not an
            open-ended chat window.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-[14px] border border-border bg-surface shadow-card">
          <div className="grid grid-cols-[1.1fr_0.9fr] border-b border-border bg-surface-muted/60 px-4 py-4 sm:grid-cols-[1.25fr_1fr_1fr] sm:px-6">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Capability
            </div>
            <div className="hidden font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted sm:block">
              Generic AI codegen
            </div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              CodeShift AI
            </div>
          </div>
          {comparisons.map((row) => (
            <div
              key={row.capability}
              className="grid grid-cols-[1.1fr_0.9fr] items-center border-b border-border px-4 py-4 last:border-b-0 sm:grid-cols-[1.25fr_1fr_1fr] sm:px-6"
            >
              <div className="pr-3 text-xs font-semibold text-text-primary sm:text-sm">
                {row.capability}
              </div>
              <div className="hidden items-center gap-2 pr-4 text-xs text-text-secondary sm:flex">
                {row.genericState === "no" ? (
                  <X className="size-3.5 text-danger" />
                ) : (
                  <Minus className="size-3.5 text-warning" />
                )}
                {row.generic}
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                  <Check className="size-3" strokeWidth={2.5} />
                </span>
                {row.codeshift}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
