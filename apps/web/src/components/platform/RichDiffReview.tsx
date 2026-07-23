import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

interface RichDiffChange {
  path: string;
  recipe: string;
  reason: string;
  confidence: number;
  risk: string;
  behaviour: string;
  before: string;
  after: string;
  evidence: string[];
  assumptions: string[];
}

export function RichDiffReview({ change }: { change: RichDiffChange }) {
  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
              Rich diff review
            </p>
            <h3 className="mt-2 text-sm font-semibold text-text-primary">
              {change.path}
            </h3>
          </div>
          <div className="flex gap-2">
            <Badge tone="info">{change.recipe}</Badge>
            <Badge tone="warning">{change.risk}</Badge>
            <Badge>{Math.round(change.confidence * 100)}% confidence</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <CodePanel label="Original code" code={change.before} tone="danger" />
          <CodePanel label="Updated code" code={change.after} tone="success" />
        </div>
        <div className="grid gap-4 text-xs md:grid-cols-2">
          <Evidence label="Reason" values={[change.reason]} />
          <Evidence label="Behaviour potentially affected" values={[change.behaviour]} />
          <Evidence label="Validation evidence" values={change.evidence} />
          <Evidence label="Unsupported assumptions" values={change.assumptions} />
        </div>
        <div className="rounded-lg border border-border bg-surface-muted p-3 text-xs text-text-secondary">
          Rollback: restore this file from the stage checkpoint or apply the exported reverse patch.
        </div>
      </CardContent>
    </Card>
  );
}

function CodePanel({
  label,
  code,
  tone,
}: {
  label: string;
  code: string;
  tone: "danger" | "success";
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-code-background">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
        <span className={`size-2 rounded-full ${tone === "success" ? "bg-success" : "bg-danger"}`} />
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
          {label}
        </span>
      </div>
      <pre className="code-scroll overflow-x-auto p-4 font-mono text-[11px] leading-5 text-code-text">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Evidence({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
        {label}
      </p>
      <ul className="mt-3 space-y-2 text-text-secondary">
        {values.map((value) => (
          <li key={value}>• {value}</li>
        ))}
      </ul>
    </div>
  );
}
