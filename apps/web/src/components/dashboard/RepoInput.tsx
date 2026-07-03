"use client";

import type { FormEvent } from "react";
import {
  Check,
  Circle,
  CircleAlert,
  Github,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export const ANALYSIS_STEPS = [
  "Validating repository URL",
  "Fetching GitHub metadata",
  "Scanning file tree",
  "Reading package.json",
  "Calculating migration readiness",
] as const;

export function RepoInput({
  value,
  onChange,
  onAnalyze,
  isLoading,
  currentStep,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  currentStep: number;
  error: string | null;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAnalyze();
  };

  return (
    <Card id="repositories" className="p-5 shadow-none sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-muted text-text-secondary">
              <Github className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                Analyze a public repository
              </h2>
              <p className="mt-0.5 text-xs text-text-muted">
                Inspect migration readiness without running repository code.
              </p>
            </div>
          </div>
        </div>
        <Badge tone="primary">Public GitHub</Badge>
      </div>

      <form
        className="mt-6 flex flex-col gap-2 sm:flex-row"
        onSubmit={handleSubmit}
      >
        <div className="relative flex-1">
          <Github className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            aria-label="GitHub repository URL"
            placeholder="https://github.com/expressjs/express"
            className="pl-10"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={isLoading}
            autoComplete="url"
          />
        </div>
        <Button
          type="submit"
          disabled={isLoading || value.trim().length === 0}
          className="sm:w-auto"
        >
          {isLoading ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : null}
          {isLoading ? "Analyzing…" : "Analyze repository"}
        </Button>
      </form>

      <div className="mt-3 flex items-start gap-2 text-[10px] leading-4 text-text-muted">
        <LockKeyhole className="mt-0.5 size-3 shrink-0" />
        <span>
          Read-only GitHub API access. No clone, install, or script execution.
        </span>
      </div>

      {isLoading ? (
        <div
          className="mt-5 rounded-[10px] border border-border bg-background p-4"
          aria-live="polite"
        >
          <p className="mb-3 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Repository analysis
          </p>
          <div className="grid gap-2 sm:grid-cols-5">
            {ANALYSIS_STEPS.map((step, index) => {
              const complete = index < currentStep;
              const active = index === currentStep;

              return (
                <div
                  key={step}
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-2.5 ${
                    active
                      ? "border-primary/35 bg-primary/10 text-primary"
                      : "border-border bg-surface text-text-muted"
                  }`}
                >
                  {complete ? (
                    <Check className="mt-0.5 size-3 shrink-0 text-success" />
                  ) : active ? (
                    <LoaderCircle className="mt-0.5 size-3 shrink-0 animate-spin" />
                  ) : (
                    <Circle className="mt-0.5 size-3 shrink-0" />
                  )}
                  <span className="text-[9px] font-medium leading-4">
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          className="mt-4 flex items-start gap-2 rounded-[10px] border border-danger/25 bg-danger/10 px-3.5 py-3 text-danger"
          role="alert"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="text-xs font-semibold">Analysis could not start</p>
            <p className="mt-1 text-[11px] leading-5">{error}</p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
