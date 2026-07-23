import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export function DotNetCompatibilityPanel({
  compatibility,
}: {
  compatibility: Record<string, string>;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">.NET compatibility assessment</h3>
          <Badge tone="warning">Approval gated</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(compatibility).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-surface-muted/40 p-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted">
              {label.replace(/([A-Z])/g, " $1")}
            </p>
            <p className="mt-2 text-xs font-medium leading-5 text-text-secondary">
              {value}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
