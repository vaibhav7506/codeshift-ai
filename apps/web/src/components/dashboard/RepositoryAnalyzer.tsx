"use client";

import { useEffect, useRef, useState } from "react";
import type { MigrationPlan as MigrationPlanData, RepositoryAnalysis } from "@codeshift/shared";
import { AnalysisPreview } from "./AnalysisPreview";
import { MigrationPlan } from "./MigrationPlan";
import { ANALYSIS_STEPS, RepoInput } from "./RepoInput";

interface AnalysisApiResponse {
  analysis?: RepositoryAnalysis;
  error?: {
    code: string;
    message: string;
  };
}

interface PlanApiResponse {
  plan?: MigrationPlanData;
  error?: {
    code: string;
    message: string;
  };
}

export function RepositoryAnalyzer() {
  const [repoUrl, setRepoUrl] = useState("");
  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedScope, setSelectedScope] = useState<string | null>(null);
  const [plan, setPlan] = useState<MigrationPlanData | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  const analyze = async () => {
    if (isLoading || repoUrl.trim().length === 0) return;

    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    setSelectedScope(null);
    setPlan(null);
    setPlanError(null);
    setCurrentStep(0);

    intervalRef.current = setInterval(() => {
      setCurrentStep((step) => Math.min(step + 1, ANALYSIS_STEPS.length - 2));
    }, 700);

    try {
      const response = await fetch("/api/repos/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The repository analysis could not be completed.",
      );
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
    setPlanError(null);
  };

  const generatePlan = async () => {
    if (!analysis || isGeneratingPlan) return;

    setIsGeneratingPlan(true);
    setPlanError(null);

    try {
      const response = await fetch("/api/plans/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          analysis,
          selectedScope: selectedScope ?? undefined,
        }),
      });
      const result = (await response.json()) as PlanApiResponse;

      if (!response.ok || !result.plan) {
        throw new Error(
          result.error?.message ?? "The migration plan could not be generated.",
        );
      }

      setPlan(result.plan);
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
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const editScope = () => {
    setPlan(null);
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
      <AnalysisPreview
        analysis={analysis}
        isLoading={isLoading}
        selectedScope={selectedScope}
        onSelectScope={selectScope}
        onGeneratePlan={generatePlan}
        isGeneratingPlan={isGeneratingPlan}
        planError={planError}
      />
      {plan ? <MigrationPlan plan={plan} onEditScope={editScope} /> : null}
    </div>
  );
}
