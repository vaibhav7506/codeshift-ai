import { LockKeyhole } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeading } from "@/components/platform/PageHeading";
import { RecipeCatalog } from "@/components/platform/RecipeCatalog";
import { Card, CardContent } from "@/components/ui/Card";
import { ACTIVE_RECIPE_CATALOG } from "@codeshift/platform/recipe-catalog-runtime";

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
          description="Recipe availability is read from the server registry. Disabled implementations remain visible as coming soon unless explicitly marked internal."
        />
        <RecipeCatalog recipes={ACTIVE_RECIPE_CATALOG} />
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
