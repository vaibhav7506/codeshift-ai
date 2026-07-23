import { CheckCircle2, LockKeyhole } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeading } from "@/components/platform/PageHeading";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { modernizationRecipes } from "@/lib/platform-demo";

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
        <div className="grid gap-4 lg:grid-cols-2">
          {modernizationRecipes.map(([name, source, target, mode]) => (
            <Card key={name} className="shadow-none">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-text-primary">{name}</h3>
                      <Badge tone="success">Active</Badge>
                      <Badge>v1.0.0</Badge>
                    </div>
                    <p className="mt-2 text-xs text-text-secondary">
                      {source} → {target}
                    </p>
                  </div>
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-success/25 bg-success/10 text-success">
                    <CheckCircle2 className="size-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <RecipeDetail
                    label="Execution mode"
                    values={[mode, "Approved scope only"]}
                  />
                  <RecipeDetail
                    label="Safety"
                    values={["Checkpoint required", "Unsupported cases reported"]}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="shadow-none">
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <LockKeyhole className="size-4 text-primary" />
              AI is optional and requires explicit consent; deterministic transformations and assessment reports do not depend on AI.
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
