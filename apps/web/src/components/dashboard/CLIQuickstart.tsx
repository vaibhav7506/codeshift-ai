import { Check, Copy, TerminalSquare } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export function CLIQuickstart() {
  return (
    <Card className="overflow-hidden shadow-none">
      <div className="flex items-start justify-between gap-4 border-b border-border p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-muted text-primary">
            <TerminalSquare className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              CLI quickstart
            </h2>
            <p className="mt-1 text-xs leading-5 text-text-muted">
              Analyze and plan safely from your local repository checkout.
            </p>
          </div>
        </div>
        <Badge tone="success">Available</Badge>
      </div>

      <div className="p-5">
        <div className="overflow-hidden rounded-[10px] border border-[#1e293b] bg-code-background">
          <div className="flex items-center justify-between border-b border-[#1e293b] px-3 py-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#94a3b8]">
              Local command
            </span>
            <Copy className="size-3 text-[#64748b]" />
          </div>
          <div className="code-scroll overflow-x-auto p-3 font-mono text-[11px] text-code-text">
            <span className="mr-2 text-[#2dd4bf]">$</span>
            <span className="whitespace-nowrap">codeshift-ai analyze</span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {[
            "Runs from your local repository",
            "Produces a reviewable analysis artifact",
            "Makes no source changes during analysis",
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-2 text-[11px] text-text-secondary"
            >
              <Check className="size-3 text-success" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
