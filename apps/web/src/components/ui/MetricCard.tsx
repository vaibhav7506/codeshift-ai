import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "./Card";

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <Card className="group p-4 shadow-none">
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border",
            accent
              ? "border-primary/25 bg-primary/10 text-primary"
              : "border-border bg-surface-muted text-text-secondary",
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
        </div>
        <ArrowUpRight
          aria-hidden="true"
          className="size-4 text-text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        />
      </div>
      <p className="mt-5 text-2xl font-semibold tracking-tight text-text-primary">
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-2 font-mono text-[10px] text-text-muted">{detail}</p>
    </Card>
  );
}
