import { CheckCircle2, CircleAlert, X } from "lucide-react";

export function Toast({
  tone,
  message,
  onDismiss,
}: {
  tone: "success" | "error";
  message: string;
  onDismiss: () => void;
}) {
  const Icon = tone === "success" ? CheckCircle2 : CircleAlert;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-[12px] border border-border bg-surface p-4 text-sm text-text-primary shadow-card"
    >
      <Icon className={`mt-0.5 size-4 shrink-0 ${tone === "success" ? "text-success" : "text-danger"}`} />
      <p className="leading-5">{message}</p>
      <button
        type="button"
        aria-label="Dismiss message"
        className="text-text-muted transition hover:text-text-primary"
        onClick={onDismiss}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
