"use client";

import { useEffect, useRef, useState } from "react";
import type { MigrationPlan as MigrationPlanData, RepositoryAnalysis } from "@codeshift/shared";
import type { RecipeCatalogEntry } from "@codeshift/platform/recipe-catalog-runtime";
import { AnalysisPreview } from "./AnalysisPreview";
import { MigrationPlan } from "./MigrationPlan";
import type { DashboardWorkflowState } from "./MigrationStepper";
import { ANALYSIS_STEPS, RepoInput } from "./RepoInput";
import { Card } from "@/components/ui/Card";

interface AnalysisApiResponse {
  analysis?: RepositoryAnalysis;
  error?: {
    code: string;
    message: string;
  };
}

interface PlanApiResponse {
  plan?: MigrationPlanData;
  campaignId?: string;
  recipe?: { id: string; name: string; version: string };
  error?: {
    code: string;
    message: string;
  };
}

export function RepositoryAnalyzer({
  onWorkflowChange,
}: {
  onWorkflowChange: (workflow: DashboardWorkflowState) => void;
}) {
  const [repoUrl, setRepoUrl] = useState("");
  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedScope, setSelectedScope] = useState<string | null>(null);
  const [plan, setPlan] = useState<MigrationPlanData | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [recipes, setRecipes] = useState<RecipeCatalogEntry[]>([]);
  const [recipeId, setRecipeId] = useState("");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [plannedRecipe, setPlannedRecipe] = useState<PlanApiResponse["recipe"]>();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  useEffect(() => {
    void fetch("/api/recipes")
      .then((response) => response.json() as Promise<{ recipes?: RecipeCatalogEntry[] }>)
      .then((body) =>
        setRecipes((body.recipes ?? []).filter((recipe) => recipe.status === "active")),
      )
      .catch(() => setPlanError("Migration choices could not be loaded."));
  }, []);

  const analyze = async () => {
    if (isLoading || repoUrl.trim().length === 0) return;

    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    setSelectedScope(null);
    setPlan(null);
    setCampaignId(null);
    setPlannedRecipe(undefined);
    setPlanError(null);
    setCurrentStep(0);
    onWorkflowChange({ phase: "ANALYZING" });

    intervalRef.current = setInterval(() => {
      setCurrentStep((step) => Math.min(step + 1, ANALYSIS_STEPS.length - 2));
    }, 700);

    try {
      const response = await fetch("/api/repos/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-codeshift-csrf": "1",
        },
        body: JSON.stringify({ repoUrl: repoUrl.trim() }),
      });
      const result = (await response.json()) as AnalysisApiResponse;

      if (!response.ok || !result.analysis) {
        throw new Error(
          result.error?.message ??
            "The repository analysis could not be completed.",
        );
      }

      setCurrentStep(ANALYSIS_STEPS.length - 1);
      await new Promise((resolve) => setTimeout(resolve, 300));
      setAnalysis(result.analysis);
      setSelectedScope(result.analysis.recommendedScopes[0]?.path ?? null);
      onWorkflowChange({ phase: "ANALYZED" });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The repository analysis could not be completed.",
      );
      onWorkflowChange({ phase: "ERROR", failedStep: "analysis" });
    } finally {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsLoading(false);
    }
  };

  const selectScope = (scope: string) => {
    setSelectedScope(scope);
    setPlan(null);
    setCampaignId(null);
    setPlannedRecipe(undefined);
    setPlanError(null);
    onWorkflowChange({ phase: "ANALYZED" });
  };

  const generatePlan = async () => {
    if (!analysis || !recipeId || isGeneratingPlan) {
      if (!recipeId) setPlanError("Select a migration before generating a plan.");
      return;
    }
    const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId);
    if (!selectedRecipe) {
      setPlanError("Select an enabled migration recipe.");
      return;
    }

    setIsGeneratingPlan(true);
    setPlanError(null);
    onWorkflowChange({ phase: "PLANNING" });

    try {
      const response = await fetch("/api/plans/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-codeshift-csrf": "1",
        },
        body: JSON.stringify({
          analysis,
          selectedScope,
          recipeId: selectedRecipe.id,
          recipeVersion: selectedRecipe.version,
          recipeConfiguration: defaultRecipeConfiguration(selectedRecipe.id),
        }),
      });
      const result = (await response.json()) as PlanApiResponse;

      if (!response.ok || !result.plan || !result.campaignId || !result.recipe) {
        throw new Error(
          result.error?.message ?? "The migration plan could not be generated.",
        );
      }

      setPlan(result.plan);
      setCampaignId(result.campaignId);
      setPlannedRecipe(result.recipe);
      onWorkflowChange({ phase: "PLAN_READY" });
      requestAnimationFrame(() => {
        document
          .getElementById("migration-plan")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (caughtError) {
      setPlanError(
        caughtError instanceof Error
          ? caughtError.message
          : "The migration plan could not be generated.",
      );
      onWorkflowChange({ phase: "ERROR", failedStep: "plan" });
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const editScope = () => {
    setPlan(null);
    onWorkflowChange({ phase: "ANALYZED" });
    requestAnimationFrame(() => {
      document
        .getElementById("scope-selector")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  return (
    <div className="space-y-5">
      <RepoInput
        value={repoUrl}
        onChange={setRepoUrl}
        onAnalyze={analyze}
        isLoading={isLoading}
        currentStep={currentStep}
        error={error}
      />
      <Card className="p-4 shadow-none">
        <label className="block space-y-2 text-xs font-medium text-text-secondary">
          What do you want to migrate?
          <select
            value={recipeId}
            onChange={(event) => {
              setRecipeId(event.target.value);
              setPlan(null);
              setCampaignId(null);
              setPlannedRecipe(undefined);
              setPlanError(null);
            }}
            className="h-10 w-full rounded-[10px] border border-border bg-background px-3 text-sm text-text-primary"
            required
          >
            <option value="" disabled>Select a migration</option>
            {recipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>{recipe.name}</option>
            ))}
          </select>
        </label>
      </Card>
      <AnalysisPreview
        analysis={analysis}
        isLoading={isLoading}
        selectedScope={selectedScope}
        onSelectScope={selectScope}
        onGeneratePlan={generatePlan}
        isGeneratingPlan={isGeneratingPlan}
        planError={planError}
      />
      {plan && campaignId && plannedRecipe ? (
        <MigrationPlan
          plan={plan}
          campaignId={campaignId}
          recipe={plannedRecipe}
          onEditScope={editScope}
        />
      ) : null}
    </div>
  );
}

function defaultRecipeConfiguration(
  recipeId: string,
): Record<string, string | boolean> {
  if (recipeId === "js-to-ts") {
    return { strictness: "strict", allowJavaScript: false };
  }
  if (recipeId === "express-to-hono") {
    return { targetRuntime: "node", routeParity: true };
  }
  if (recipeId === "css-to-tailwind") {
    return { safeMode: true, preserveOriginalCss: true, visualRegression: true };
  }
  if (recipeId === "commonjs-to-esm") {
    return {
      dynamicRequirePolicy: "preserve",
      updatePackageJson: true,
      convertConfiguration: true,
    };
  }
  if (recipeId === "classes-to-hooks") {
    return {
      includeTests: true,
      preserveErrorBoundaries: true,
      behaviourChecks: true,
    };
  }
  if (recipeId === "callbacks-to-async") {
    return {
      errorPathValidation: true,
      preserveSequential: true,
      excludeEventDriven: true,
    };
  }
  if (recipeId === "dotnet-framework-modernization") {
    return {
      targetVersion: "net8.0",
      sdkStyleConversion: true,
      packageReferenceConversion: true,
      linuxCompatibility: true,
    };
  }
  if (recipeId === "aspnet-to-aspnet-core") {
    return {
      targetVersion: "net8.0",
      authenticationMigration: true,
      systemWebReport: true,
      routeParity: true,
    };
  }
  return { preserveUnsupportedCases: true };
}
