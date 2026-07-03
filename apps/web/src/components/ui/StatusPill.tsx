import { Check, Circle, Clock3, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusTone = "success" | "warning" | "danger" | "neutral" | "info";

const styles: Record<StatusTone, string> = {
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  danger: "border-danger/25 bg-danger/10 text-danger",
  neutral: "border-border bg-surface-muted text-text-secondary",
  info: "border-info/25 bg-info/10 text-info",
};

const icons = {
  success: Check,
  warning: TriangleAlert,
  danger: TriangleAlert,
  neutral: Clock3,
  info: Circle,
};

export function StatusPill({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
}) {
  const Icon = icons[tone];

  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold",
        styles[tone],
        className,
      )}
    >
      {dot ? (
        <span className="size-1.5 rounded-full bg-current" />
      ) : (
        <Icon aria-hidden="true" className="size-3" strokeWidth={2.5} />
      )}
      {children}
    </span>
  );
}
