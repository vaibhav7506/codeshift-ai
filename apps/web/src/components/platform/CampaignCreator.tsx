"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { RecipeCatalogEntry } from "@codeshift/platform/recipe-catalog-runtime";
import { ArrowRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

interface RecipeResponse {
  recipes?: RecipeCatalogEntry[];
}

export function CampaignCreator() {
  const [recipes, setRecipes] = useState<RecipeCatalogEntry[]>([]);
  const [recipeId, setRecipeId] = useState("");
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === recipeId),
    [recipeId, recipes],
  );

  useEffect(() => {
    void fetch("/api/recipes")
      .then((response) => response.json() as Promise<RecipeResponse>)
      .then((body) => setRecipes(body.recipes ?? []))
      .catch(() => setError("Migration choices could not be loaded."));
  }, []);

  const executable = recipes.filter((recipe) => recipe.status === "active");
  const assessments = recipes.filter((recipe) => recipe.status === "assessment");

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-4">
        {["Repository", "Recipe", "Scope & risk", "Validation"].map((step, index) => (
          <div key={step} className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary">
            <span className="mr-2 font-mono text-[10px] text-primary">{index + 1}</span>
            {step}
          </div>
        ))}
      </div>
      <Card className="shadow-none">
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_240px_minmax(0,0.8fr)_auto]"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!selectedRecipe || submitting) return;
              const form = new FormData(event.currentTarget);
              const name = String(form.get("campaignName") ?? "").trim();
              const scope = String(form.get("scope") ?? "").trim();
              const id = `campaign-${crypto.randomUUID()}`;
              setSubmitting(true);
              setError(null);
              try {
                const response = await fetch("/api/campaigns", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-codeshift-csrf": "1",
                  },
                  body: JSON.stringify({
                    id,
                    repositoryId: "local-repository",
                    name,
                    selectedRecipes: [{ id: selectedRecipe.id, version: selectedRecipe.version }],
                    paths: [scope],
                    protectedPaths: [".github/**"],
                    riskScore: 35,
                    estimatedAffectedFiles: 0,
                    validationRequirements: selectedRecipe.validationRequirements,
                    targetVersion: String(form.get("targetVersion") ?? "").trim() || undefined,
                    recipeConfiguration: recipeConfiguration(form, selectedRecipe.id),
                  }),
                });
                const body = (await response.json()) as { campaign?: { id: string; name: string }; error?: { message?: string } };
                if (!response.ok || !body.campaign) {
                  throw new Error(body.error?.message ?? "The campaign could not be created.");
                }
                setCreated({ id: body.campaign.id, name: body.campaign.name });
              } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : "The campaign could not be created.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <label className="space-y-2 text-xs font-medium text-text-secondary">
              Campaign name
              <Input name="campaignName" maxLength={100} placeholder="Utilities migration" required />
            </label>
            <label className="space-y-2 text-xs font-medium text-text-secondary">
              What do you want to migrate?
              <select
                name="recipe"
                value={recipeId}
                onChange={(event) => setRecipeId(event.target.value)}
                required
                className="h-10 w-full rounded-[10px] border border-border bg-background px-3 text-sm text-text-primary"
              >
                <option value="" disabled>Select a migration</option>
                <optgroup label="Executable migrations">
                  {executable.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>{recipe.name}</option>
                  ))}
                </optgroup>
                {assessments.length > 0 ? (
                  <optgroup label="Assessments">
                    {assessments.map((recipe) => (
                      <option key={recipe.id} value={recipe.id} disabled>
                        {recipe.name} — assessment only
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </label>
            <label className="space-y-2 text-xs font-medium text-text-secondary">
              Approved scope
              <Input name="scope" placeholder="src/utils" maxLength={300} required />
            </label>
            <Button className="self-end" type="submit" disabled={!selectedRecipe || submitting}>
              <Plus className="size-4" />
              {submitting ? "Creating…" : "Create draft"}
            </Button>
            {selectedRecipe ? <RecipeConfiguration recipeId={selectedRecipe.id} /> : null}
          </form>
          {error ? <p role="alert" className="mt-3 text-xs text-danger">{error}</p> : null}
          <p className="mt-3 text-xs text-text-muted">
            Draft creation does not execute code or modify a repository. Protected files and validation evidence are reviewed before approval.
          </p>
        </CardContent>
      </Card>

      {created ? (
        <Card className="border-primary/30 shadow-none">
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge tone="primary">Draft</Badge>
                <span className="font-mono text-[10px] text-text-muted">LOCAL CONTROL PLANE</span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-text-primary">{created.name}</h3>
              <p className="mt-1 text-xs text-text-secondary">Scope, risk, and validation must be reviewed before approval.</p>
            </div>
            <Link href={`/campaigns/${created.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Review campaign
              <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function RecipeConfiguration({ recipeId }: { recipeId: string }) {
  if (recipeId === "js-to-ts") {
    return (
      <label className="space-y-2 text-xs font-medium text-text-secondary">
        Strictness level
        <select name="strictness" defaultValue="strict" className="h-10 w-full rounded-[10px] border border-border bg-background px-3 text-sm text-text-primary">
          <option value="strict">Strict</option>
          <option value="transition">Allow JavaScript during transition</option>
        </select>
      </label>
    );
  }
  if (recipeId === "express-to-hono") {
    return (<>
      <label className="space-y-2 text-xs font-medium text-text-secondary">
        Target runtime
        <select name="targetRuntime" defaultValue="node" className="h-10 w-full rounded-[10px] border border-border bg-background px-3 text-sm text-text-primary">
          <option value="node">Node</option>
          <option value="cloudflare-workers">Cloudflare Workers</option>
        </select>
      </label>
      <ConfigurationCheck name="routeParity" label="Include route-parity testing" />
      <ConfigurationCheck name="middlewareMigration" label="Include middleware migration" />
    </>);
  }
  if (recipeId === "css-to-tailwind") {
    return (<>
      <ConfigurationCheck name="safeMode" label="Use Tailwind safe mode" />
      <ConfigurationCheck name="preserveOriginalCss" label="Preserve original CSS" />
      <ConfigurationCheck name="visualRegression" label="Run visual regression" />
    </>);
  }
  if (recipeId === "classes-to-hooks") {
    return (<>
      <ConfigurationCheck name="includeTests" label="Include component tests" />
      <ConfigurationCheck name="preserveErrorBoundaries" label="Preserve error boundaries" />
      <ConfigurationCheck name="behaviourChecks" label="Require behaviour checks" />
    </>);
  }
  if (recipeId === "callbacks-to-async") {
    return (<>
      <ConfigurationCheck name="errorPathValidation" label="Validate error paths" />
      <ConfigurationCheck name="preserveSequential" label="Preserve sequential behaviour" />
      <ConfigurationCheck name="excludeEventDriven" label="Exclude streams and event emitters" />
    </>);
  }
  if (recipeId === "commonjs-to-esm") {
    return (<>
      <label className="space-y-2 text-xs font-medium text-text-secondary">
        Dynamic require policy
        <select name="dynamicRequirePolicy" defaultValue="preserve" className="h-10 w-full rounded-[10px] border border-border bg-background px-3 text-sm text-text-primary">
          <option value="preserve">Preserve and report</option>
          <option value="fail">Stop for review</option>
        </select>
      </label>
      <ConfigurationCheck name="updatePackageJson" label="Update package.json" />
      <ConfigurationCheck name="convertConfiguration" label="Convert configuration files" />
    </>);
  }
  if (recipeId === "dotnet-framework-modernization") {
    return (<>
      <label className="space-y-2 text-xs font-medium text-text-secondary">
        Target LTS version
        <Input name="targetVersion" placeholder="net8.0" maxLength={100} required />
      </label>
      <ConfigurationCheck name="sdkStyleConversion" label="Convert to SDK-style projects" />
      <ConfigurationCheck name="packageReferenceConversion" label="Convert PackageReference dependencies" />
      <ConfigurationCheck name="linuxCompatibility" label="Run Linux compatibility analysis" />
      <ConfigurationCheck name="containerReadiness" label="Check container readiness" />
    </>);
  }
  if (recipeId === "aspnet-to-aspnet-core") {
    return (<>
      <label className="space-y-2 text-xs font-medium text-text-secondary">
        Target .NET version
        <Input name="targetVersion" placeholder="net8.0" maxLength={100} required />
      </label>
      <ConfigurationCheck name="authenticationMigration" label="Include authentication migration" />
      <ConfigurationCheck name="sessionMigration" label="Include session migration" />
      <ConfigurationCheck name="systemWebReport" label="Report System.Web blockers" />
      <ConfigurationCheck name="routeParity" label="Require route-parity validation" />
    </>);
  }
  return (
    <label className="flex items-center gap-2 self-end pb-2 text-xs font-medium text-text-secondary">
      <input name="safeMode" type="checkbox" defaultChecked />
      Preserve unsupported cases for review
    </label>
  );
}

function ConfigurationCheck({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 self-end pb-2 text-xs font-medium text-text-secondary">
      <input name={name} type="checkbox" defaultChecked />
      {label}
    </label>
  );
}

function recipeConfiguration(
  form: FormData,
  recipeId: string,
): Record<string, string | boolean> {
  if (recipeId === "js-to-ts") {
    return { strictness: String(form.get("strictness") ?? "strict") };
  }
  if (recipeId === "express-to-hono") {
    return {
      targetRuntime: String(form.get("targetRuntime") ?? "node"),
      routeParity: checked(form, "routeParity"),
      middlewareMigration: checked(form, "middlewareMigration"),
    };
  }
  if (recipeId === "css-to-tailwind") {
    return {
      safeMode: checked(form, "safeMode"),
      preserveOriginalCss: checked(form, "preserveOriginalCss"),
      visualRegression: checked(form, "visualRegression"),
    };
  }
  if (recipeId === "classes-to-hooks") {
    return {
      includeTests: checked(form, "includeTests"),
      preserveErrorBoundaries: checked(form, "preserveErrorBoundaries"),
      behaviourChecks: checked(form, "behaviourChecks"),
    };
  }
  if (recipeId === "callbacks-to-async") {
    return {
      errorPathValidation: checked(form, "errorPathValidation"),
      preserveSequential: checked(form, "preserveSequential"),
      excludeEventDriven: checked(form, "excludeEventDriven"),
    };
  }
  if (recipeId === "commonjs-to-esm") {
    return {
      dynamicRequirePolicy: String(form.get("dynamicRequirePolicy") ?? "preserve"),
      updatePackageJson: checked(form, "updatePackageJson"),
      convertConfiguration: checked(form, "convertConfiguration"),
    };
  }
  if (recipeId === "dotnet-framework-modernization") {
    return {
      targetVersion: String(form.get("targetVersion") ?? ""),
      sdkStyleConversion: checked(form, "sdkStyleConversion"),
      packageReferenceConversion: checked(form, "packageReferenceConversion"),
      linuxCompatibility: checked(form, "linuxCompatibility"),
      containerReadiness: checked(form, "containerReadiness"),
    };
  }
  if (recipeId === "aspnet-to-aspnet-core") {
    return {
      targetVersion: String(form.get("targetVersion") ?? ""),
      authenticationMigration: checked(form, "authenticationMigration"),
      sessionMigration: checked(form, "sessionMigration"),
      systemWebReport: checked(form, "systemWebReport"),
      routeParity: checked(form, "routeParity"),
    };
  }
  return { safeMode: form.get("safeMode") === "on" };
}

function checked(form: FormData, name: string): boolean {
  return form.get(name) === "on";
}
