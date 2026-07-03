import type {
  AnalysisRiskLevel,
  RepositoryAnalysis,
} from "@codeshift/shared";
import {
  Boxes,
  Check,
  CircleDashed,
  CircleAlert,
  FileCode2,
  Gauge,
  GitBranch,
  LoaderCircle,
  Package,
  PanelsTopLeft,
  ShieldAlert,
  X,
} from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { titleCase } from "@/lib/utils";

export function AnalysisPreview({
  analysis,
  isLoading,
  selectedScope,
  onSelectScope,
  onGeneratePlan,
  isGeneratingPlan,
  planError,
}: {
  analysis: RepositoryAnalysis | null;
  isLoading: boolean;
  selectedScope: string | null;
  onSelectScope: (scope: string) => void;
  onGeneratePlan: () => void;
  isGeneratingPlan: boolean;
  planError: string | null;
}) {
  if (!analysis) {
    return (
      <section id="runs" aria-labelledby="analysis-preview-title">
        <div className="mb-4">
          <h2
            id="analysis-preview-title"
            className="text-sm font-semibold text-text-primary"
          >
            Repository analysis
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Readiness, risks, and safe starting scopes will appear here.
          </p>
        </div>
        <Card className="flex min-h-44 flex-col items-center justify-center p-6 text-center shadow-none">
          <span className="flex size-10 items-center justify-center rounded-[10px] border border-border bg-surface-muted text-text-muted">
            <CircleDashed
              className={`size-4 ${isLoading ? "animate-spin text-primary" : ""}`}
            />
          </span>
          <h3 className="mt-4 text-sm font-semibold text-text-primary">
            {isLoading ? "Analyzing repository structure" : "Awaiting repository"}
          </h3>
          <p className="mt-1.5 max-w-sm text-xs leading-5 text-text-muted">
            {isLoading
              ? "CodeShift AI is reading repository metadata and selected source text."
              : "Enter a public GitHub repository above to generate a real migration analysis."}
          </p>
        </Card>
      </section>
    );
  }

  const metrics = [
    {
      label: "Migration readiness",
      value: `${analysis.readinessScore} / 100`,
      detail: `${analysis.difficulty} DIFFICULTY`,
      icon: Gauge,
      accent: true,
    },
    {
      label: "Framework",
      value: titleCase(analysis.framework),
      detail: "DEPENDENCY SIGNAL",
      icon: PanelsTopLeft,
    },
    {
      label: "Package manager",
      value: analysis.packageManager,
      detail: "LOCKFILE SIGNAL",
      icon: Package,
    },
    {
      label: "Module system",
      value: analysis.moduleSystem.toUpperCase(),
      detail: "SOURCE SAMPLE",
      icon: Boxes,
    },
  ];

  return (
    <section id="runs" aria-labelledby="analysis-preview-title">
      <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2
              id="analysis-preview-title"
              className="text-sm font-semibold text-text-primary"
            >
              {analysis.owner}/{analysis.repo}
            </h2>
            <StatusPill tone={difficultyTone(analysis.difficulty)} dot>
              {analysis.difficulty}
            </StatusPill>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
            <GitBranch className="size-3" />
            {analysis.defaultBranch} · {analysis.totalFiles.toLocaleString()} files
          </p>
        </div>
        <Badge tone="success">Analysis complete</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <Card className="mt-3 overflow-hidden shadow-none">
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <div>
            <h3 className="text-xs font-semibold text-text-primary">
              Source inventory
            </h3>
            <p className="mt-0.5 text-[10px] text-text-muted">
              File counts from the default branch tree.
            </p>
          </div>
          <Badge>{analysis.totalFiles.toLocaleString()} total</Badge>
        </div>
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          <FileCount label="JavaScript" value={analysis.jsFiles} extension=".js" />
          <FileCount label="TypeScript" value={analysis.tsFiles} extension=".ts" />
          <FileCount label="React JS" value={analysis.jsxFiles} extension=".jsx" />
          <FileCount label="React TS" value={analysis.tsxFiles} extension=".tsx" />
        </div>
      </Card>

      <Card className="mt-3 overflow-hidden shadow-none">
        <div className="border-b border-border px-4 py-3.5">
          <h3 className="text-xs font-semibold text-text-primary">
            Validation signals
          </h3>
          <p className="mt-0.5 text-[10px] text-text-muted">
            Configuration and package-script gates detected without execution.
          </p>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-5">
          <ValidationSignal label="tsconfig" present={analysis.hasTsConfig} />
          <ValidationSignal label="Tests" present={analysis.hasTests} />
          <ValidationSignal label="Build" present={analysis.hasBuildScript} />
          <ValidationSignal label="Lint" present={analysis.hasLintScript} />
          <ValidationSignal
            label="Typecheck"
            present={analysis.hasTypecheckScript}
          />
        </div>
      </Card>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card className="overflow-hidden shadow-none">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <div>
              <h3 className="text-xs font-semibold text-text-primary">
                Risk factors
              </h3>
              <p className="mt-0.5 text-[10px] text-text-muted">
                Signals that may increase migration effort.
              </p>
            </div>
            <Badge tone={analysis.riskFactors.length > 0 ? "warning" : "success"}>
              {analysis.riskFactors.length}
            </Badge>
          </div>
          {analysis.riskFactors.length > 0 ? (
            <div className="divide-y divide-border">
              {analysis.riskFactors.map((risk) => (
                <div key={risk.id} className="flex gap-3 px-4 py-3.5">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                    <ShieldAlert className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold text-text-primary">
                        {risk.title}
                      </p>
                      <Badge tone={riskTone(risk.severity)}>{risk.severity}</Badge>
                    </div>
                    <p className="mt-1 text-[10px] leading-4 text-text-muted">
                      {risk.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-5">
              <Check className="size-4 text-success" />
              <p className="text-xs text-text-secondary">
                No configured migration risks were detected.
              </p>
            </div>
          )}
        </Card>

        <Card
          id="scope-selector"
          className="scroll-mt-24 overflow-hidden shadow-none"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <div>
              <h3 className="text-xs font-semibold text-text-primary">
                Recommended starting scopes
              </h3>
              <p className="mt-0.5 text-[10px] text-text-muted">
                Small, non-sensitive boundaries ranked for first review.
              </p>
            </div>
            <Badge tone="primary">{analysis.recommendedScopes.length}</Badge>
          </div>
          {analysis.recommendedScopes.length > 0 ? (
            <div className="divide-y divide-border">
              {analysis.recommendedScopes.map((scope, index) => (
                <button
                  key={scope.path}
                  type="button"
                  onClick={() => onSelectScope(scope.path)}
                  aria-pressed={selectedScope === scope.path}
                  className={`block w-full px-4 py-3.5 text-left transition-colors ${
                    selectedScope === scope.path
                      ? "bg-primary/[0.07]"
                      : "bg-surface hover:bg-surface-muted/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] font-semibold ${
                          selectedScope === scope.path
                            ? "border-primary bg-primary text-white dark:text-[#051411]"
                            : "border-border text-text-muted"
                        }`}
                      >
                        {selectedScope === scope.path ? (
                          <Check className="size-3" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <code className="truncate font-mono text-xs font-semibold text-primary">
                        {scope.path}
                      </code>
                    </div>
                    <StatusPill tone={difficultyTone(scope.risk)} dot>
                      {scope.risk} · {scope.estimatedFiles}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-text-muted">
                    {scope.reason}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-5">
              <FileCode2 className="size-4 text-text-muted" />
              <p className="text-xs leading-5 text-text-secondary">
                No safe utility or library boundary was found automatically.
              </p>
            </div>
          )}
          <div className="border-t border-border bg-surface-muted/30 p-4">
            <Button
              onClick={onGeneratePlan}
              disabled={
                !selectedScope ||
                isGeneratingPlan ||
                analysis.recommendedScopes.length === 0
              }
              className="w-full"
            >
              {isGeneratingPlan ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : null}
              {isGeneratingPlan
                ? "Generating plan…"
                : "Generate Migration Plan"}
            </Button>
            <p className="mt-2 text-center text-[9px] leading-4 text-text-muted">
              Planning only. No repository files will be modified.
            </p>
            {planError ? (
              <div
                className="mt-3 flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2.5 text-danger"
                role="alert"
              >
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                <p className="text-[10px] leading-4">{planError}</p>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </section>
  );
}

function FileCount({
  label,
  value,
  extension,
}: {
  label: string;
  value: number;
  extension: string;
}) {
  return (
    <div className="bg-surface px-4 py-4">
      <p className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
        {extension}
      </p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-text-primary">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-[10px] text-text-secondary">{label}</p>
    </div>
  );
}

function ValidationSignal({
  label,
  present,
}: {
  label: string;
  present: boolean;
}) {
  return (
    <div className="flex items-center gap-2 bg-surface px-3 py-3">
      <span
        className={`flex size-5 items-center justify-center rounded-full ${
          present ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
        }`}
      >
        {present ? <Check className="size-3" /> : <X className="size-3" />}
      </span>
      <span className="text-[10px] font-medium text-text-secondary">{label}</span>
    </div>
  );
}

function difficultyTone(
  level: AnalysisRiskLevel,
): "success" | "warning" | "danger" {
  if (level === "LOW") return "success";
  if (level === "MEDIUM") return "warning";
  return "danger";
}

function riskTone(
  level: AnalysisRiskLevel,
): "success" | "warning" | "danger" {
  if (level === "LOW") return "success";
  if (level === "MEDIUM") return "warning";
  return "danger";
}
