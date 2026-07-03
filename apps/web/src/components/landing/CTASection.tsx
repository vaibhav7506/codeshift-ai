import Link from "next/link";
import {
  ArrowRight,
  Check,
  Cloud,
  GitBranch,
  Laptop,
  TerminalSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { Logo } from "./Hero";

const terminalLines = [
  { prompt: "$", content: "codeshift-ai analyze" },
  { prompt: "›", content: "Repository indexed · 184 modules", muted: true },
  { prompt: "›", content: "Migration readiness · 78 / 100", muted: true },
  {
    prompt: "✓",
    content: "Plan ready · 6 files in first review batch",
    success: true,
  },
];

export function CTASection() {
  return (
    <>
      <section id="cli" className="border-b border-border">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-28">
          <div>
            <Badge tone="primary">CLI + cloud</Badge>
            <h2 className="mt-5 max-w-xl text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
              Local where your code lives. Connected where your team reviews.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-text-secondary">
              Use the CLI to inspect and apply scoped work in your repository,
              then move approved artifacts into a shared review workflow.
            </p>
            <div className="mt-7 space-y-3">
              {[
                { icon: Laptop, text: "Run migration work from your local checkout" },
                { icon: GitBranch, text: "Keep every change on an isolated branch" },
                { icon: Cloud, text: "Share plans, checks, and reviews with your team" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.text}
                    className="flex items-center gap-3 text-sm text-text-secondary"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-primary">
                      <Icon className="size-3.5" />
                    </span>
                    {item.text}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-[14px] border border-[#1e293b] bg-code-background shadow-panel">
            <div className="flex h-11 items-center justify-between border-b border-[#1e293b] px-4 text-[#94a3b8]">
              <div className="flex items-center gap-2">
                <TerminalSquare className="size-4" />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                  CodeShift AI / workspace
                </span>
              </div>
              <span className="font-mono text-[9px] text-[#64748b]">zsh</span>
            </div>
            <div className="space-y-3 p-5 font-mono text-xs">
              {terminalLines.map((line, index) => (
                <div
                  key={index}
                  className={
                    line.muted
                      ? "text-[#94a3b8]"
                      : line.success
                        ? "text-[#22c55e]"
                        : "text-code-text"
                  }
                >
                  <span
                    className={`mr-3 select-none ${
                      line.success ? "text-[#22c55e]" : "text-[#2dd4bf]"
                    }`}
                  >
                    {line.prompt}
                  </span>
                  {line.content}
                </div>
              ))}
              <div className="pt-1">
                <span className="mr-3 text-[#2dd4bf]">$</span>
                <span className="inline-block h-4 w-1.5 animate-pulse bg-[#cbd5e1] align-middle" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 lg:py-24">
          <div className="relative overflow-hidden rounded-[14px] border border-primary/30 bg-background px-6 py-12 sm:px-10 lg:px-14">
            <div className="grid-fade grid-surface pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <div className="mb-4 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                  <Check className="size-3.5" />
                  Start with a scoped repository review
                </div>
                <h2 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
                  Make the next migration smaller, safer, and easier to review.
                </h2>
              </div>
              <Link
                href="/dashboard"
                className={buttonVariants({
                  size: "lg",
                  className: "shrink-0",
                })}
              >
                Analyze a repo
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          <footer className="flex flex-col gap-4 pt-12 sm:flex-row sm:items-center sm:justify-between">
            <Logo />
            <p className="text-xs text-text-muted">
              Reviewable migrations. Human-approved changes.
            </p>
          </footer>
        </div>
      </section>
    </>
  );
}
