import {
  Check,
  ChevronRight,
  CircleDot,
  FileCode2,
  Folder,
  GitPullRequestArrow,
  MoreHorizontal,
  TerminalSquare,
} from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";

const fileRows = [
  { name: "dates.js", state: "M" },
  { name: "errors.js", state: "M" },
  { name: "format.js", state: "M" },
  { name: "guards.js", state: "A" },
];

export function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-panel">
      <div className="flex h-11 items-center justify-between border-b border-border bg-surface-elevated px-4">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-danger/70" />
          <span className="size-2.5 rounded-full bg-warning/70" />
          <span className="size-2.5 rounded-full bg-success/70" />
        </div>
        <span className="font-mono text-[10px] font-medium text-text-muted">
          migration-run / CS-104
        </span>
        <MoreHorizontal aria-hidden="true" className="size-4 text-text-muted" />
      </div>

      <div className="grid min-h-[410px] sm:grid-cols-[155px_1fr]">
        <aside className="hidden border-r border-border bg-background/55 p-3 sm:block">
          <div className="mb-3 px-2 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Explorer
          </div>
          <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold text-text-secondary">
            <ChevronRight className="size-3" />
            <Folder className="size-3 text-info" />
            src
          </div>
          <div className="ml-3 flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1.5 text-[11px] font-semibold text-primary">
            <ChevronRight className="size-3" />
            <Folder className="size-3" />
            utils
          </div>
          <div className="ml-8 mt-1 space-y-0.5">
            {fileRows.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between rounded px-1.5 py-1 text-[10px] text-text-secondary"
              >
                <span className="flex items-center gap-1.5">
                  <FileCode2 className="size-3 text-warning" />
                  {file.name}
                </span>
                <span className="font-mono text-primary">{file.state}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <CircleDot className="size-3.5 text-success" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  Repository
                </span>
              </div>
              <h2 className="font-mono text-sm font-semibold text-text-primary">
                legacy-express-api
              </h2>
            </div>
            <StatusPill tone="success">Ready for review</StatusPill>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-border bg-border">
            <PreviewMetric label="Migration" value="JavaScript → TypeScript" />
            <PreviewMetric label="Difficulty" value="Medium" tone="warning" />
            <PreviewMetric label="Scope" value="src/utils/*" mono />
            <PreviewMetric label="Diff" value="6 files changed" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <CheckRow label="Tests" value="Passed" />
            <CheckRow label="Typecheck" value="Passed" />
          </div>

          <div className="mt-4 overflow-hidden rounded-[10px] border border-[#1e293b] bg-code-background">
            <div className="flex h-8 items-center gap-2 border-b border-[#1e293b] px-3 text-[#94a3b8]">
              <TerminalSquare className="size-3.5" />
              <span className="font-mono text-[9px] uppercase tracking-[0.14em]">
                Terminal
              </span>
            </div>
            <div className="code-scroll overflow-x-auto p-3 font-mono text-[10px] leading-5 text-code-text sm:text-[11px]">
              <span className="mr-2 select-none text-[#2dd4bf]">$</span>
              <span className="whitespace-nowrap">
                codeshift-ai migrate --path src/utils --target js-to-ts
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
              <GitPullRequestArrow className="size-4 text-primary" />
              PR
            </div>
            <span className="text-xs font-semibold text-success">
              Ready for review
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewMetric({
  label,
  value,
  mono = false,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "warning";
}) {
  return (
    <div className="min-w-0 bg-surface p-3">
      <p className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-[11px] font-semibold ${
          mono ? "font-mono" : ""
        } ${tone === "warning" ? "text-warning" : "text-text-primary"}`}
      >
        {value}
      </p>
    </div>
  );
}

function CheckRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/60 px-3 py-2">
      <span className="text-[10px] font-medium text-text-secondary">{label}</span>
      <span className="flex items-center gap-1 text-[10px] font-semibold text-success">
        <Check className="size-3" strokeWidth={2.5} />
        {value}
      </span>
    </div>
  );
}
