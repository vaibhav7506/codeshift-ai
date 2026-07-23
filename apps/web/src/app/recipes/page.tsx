import { CheckCircle2, LockKeyhole } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeading } from "@/components/platform/PageHeading";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export default function RecipesPage() {
  return (
    <AppShell
      title="Migration recipes"
      description="Versioned, permission-bounded modernization capabilities."
    >
      <div className="space-y-5">
        <PageHeading
          eyebrow="Recipe registry"
          title="Migration recipes"
          description="Only implemented and enabled recipe versions appear here. Experimental recipes remain hidden behind server-side feature flags."
        />
        <Card className="shadow-none">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-text-primary">
                    JavaScript to TypeScript
                  </h3>
                  <Badge tone="success">Active</Badge>
                  <Badge>v1.0.0</Badge>
                </div>
                <p className="mt-2 text-sm text-text-secondary">
                  Existing conservative CLI transformation wrapped by the standard recipe contract.
                </p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg border border-success/25 bg-success/10 text-success">
                <CheckCircle2 className="size-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 text-sm md:grid-cols-3">
              <RecipeDetail
                label="Permissions"
                values={["Read repository", "Write approved scope", "Run validation"]}
              />
              <RecipeDetail
                label="Validation"
                values={["Tests", "Build", "Typecheck", "Lint"]}
              />
              <RecipeDetail
                label="Rollback"
                values={["Checkpoint restore", "Patch export", "Explicit approval"]}
              />
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-lg border border-border bg-surface-muted p-3 text-xs text-text-secondary">
              <LockKeyhole className="size-4 text-primary" />
              AI is optional and requires explicit consent; deterministic transformation does not depend on AI.
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function RecipeDetail({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
        {label}
      </p>
      <ul className="mt-3 space-y-2 text-xs text-text-secondary">
        {values.map((value) => (
          <li key={value}>• {value}</li>
        ))}
      </ul>
    </div>
  );
}
