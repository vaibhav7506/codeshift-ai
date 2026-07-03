import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";

const toneStyles: Record<BadgeTone, string> = {
  neutral: "border-border bg-surface-muted text-text-secondary",
  primary: "border-primary/25 bg-primary/10 text-primary",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  danger: "border-danger/25 bg-danger/10 text-danger",
  info: "border-info/25 bg-info/10 text-info",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md border px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]",
        toneStyles[tone],
        className,
      )}
      {...props}
    />
  );
}
