import type { RecipeCatalogEntry } from "@codeshift/platform/recipe-catalog-runtime";
import { CheckCircle2, ClipboardCheck, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export function RecipeCatalog({
  recipes,
}: {
  recipes: readonly RecipeCatalogEntry[];
}) {
  if (recipes.length === 0) {
    return (
      <Card className="shadow-none">
        <CardContent>
          <p className="text-sm text-text-secondary">No public migration recipes are registered.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {recipes.map((recipe) => (
        <Card key={`${recipe.id}@${recipe.version}`} className="shadow-none">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-text-primary">{recipe.name}</h3>
                  <RecipeStatus status={recipe.status} />
                  <Badge>v{recipe.version}</Badge>
                </div>
                <p className="mt-2 text-xs text-text-secondary">
                  {recipe.sourceTechnology} → {recipe.targetTechnology}
                </p>
                <p className="mt-2 text-xs leading-5 text-text-muted">{recipe.description}</p>
              </div>
              <RecipeIcon status={recipe.status} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <RecipeDetail
                label="Execution mode"
                values={[
                  recipe.assessmentOnly ? "Assessment only" : "Deterministic transform",
                  recipe.category.replaceAll("-", " "),
                ]}
              />
              <RecipeDetail
                label="Safety"
                values={[
                  recipe.capabilities.rollback ? "Rollback supported" : "No source changes",
                  `${recipe.validationRequirements.length} validation requirements`,
                ]}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RecipeStatus({ status }: { status: RecipeCatalogEntry["status"] }) {
  if (status === "active") return <Badge tone="success">Active</Badge>;
  if (status === "assessment") return <Badge tone="info">Assessment</Badge>;
  return <Badge tone="warning">Coming soon</Badge>;
}

function RecipeIcon({ status }: { status: RecipeCatalogEntry["status"] }) {
  const Icon = status === "active" ? CheckCircle2 : status === "assessment" ? ClipboardCheck : Clock3;
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-success/25 bg-success/10 text-success">
      <Icon className="size-4" />
    </div>
  );
}

function RecipeDetail({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
        {label}
      </p>
      <ul className="mt-3 space-y-2 text-xs text-text-secondary">
        {values.map((value) => <li key={value}>• {value}</li>)}
      </ul>
    </div>
  );
}
