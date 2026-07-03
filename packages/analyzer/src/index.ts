import type {
  AnalysisRiskLevel,
  ModuleSystem,
  PackageManager,
  RecommendedScope,
  RepositoryAnalysis,
  RepositoryFramework,
  RiskFactor,
} from "@codeshift/shared";

export interface GitHubRepositoryRef {
  owner: string;
  repo: string;
}

export interface RepositoryFileEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
  content?: string;
}

export interface AnalyzeRepositoryInput {
  repoUrl: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  fileTree: RepositoryFileEntry[];
  packageJsonText: string;
}

interface PackageJsonShape {
  type?: unknown;
  scripts?: unknown;
  dependencies?: unknown;
  devDependencies?: unknown;
  peerDependencies?: unknown;
  optionalDependencies?: unknown;
}

const SOURCE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?)$/i;
const JAVASCRIPT_FILE_PATTERN = /\.(?:js|mjs|cjs)$/i;
const TYPESCRIPT_FILE_PATTERN = /\.(?:ts|mts|cts)$/i;
const TEST_FILE_PATTERN =
  /(^|\/)(?:__tests__|tests?|specs?)(\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i;
const COMMONJS_PATTERN =
  /\brequire\s*\(\s*["'`]|\bmodule\.exports\b|\bexports\.[A-Za-z_$]/m;
const ESM_PATTERN =
  /(^|\n)\s*(?:import\s+(?:["'{*]|\w)|export\s+(?:default|const|let|var|function|class|\{|\*))/m;
const DYNAMIC_REQUIRE_PATTERN = /\brequire\s*\(\s*(?!["'`])/m;
const EVAL_PATTERN = /\beval\s*\(/m;

const PREFERRED_SCOPES = [
  "src/utils",
  "src/lib",
  "src/helpers",
  "utils",
  "lib",
  "helpers",
] as const;

const AVOIDED_SCOPE_SEGMENTS = new Set([
  "auth",
  "payment",
  "payments",
  "config",
  "security",
  "secrets",
  "database",
  "migrations",
]);

export class RepositoryInputError extends Error {
  readonly code = "INVALID_REPO_URL";

  constructor(message: string) {
    super(message);
    this.name = "RepositoryInputError";
  }
}

export function parseGitHubRepoUrl(input: string): GitHubRepositoryRef {
  const value = input.trim();

  if (!value) {
    throw new RepositoryInputError("Enter a public GitHub repository URL.");
  }

  let segments: string[];

  if (/^https?:\/\//i.test(value)) {
    let parsed: URL;

    try {
      parsed = new URL(value);
    } catch {
      throw new RepositoryInputError("The repository URL is not valid.");
    }

    if (
      parsed.protocol !== "https:" ||
      parsed.hostname.toLowerCase() !== "github.com"
    ) {
      throw new RepositoryInputError(
        "Use an HTTPS URL from github.com, such as https://github.com/owner/repo.",
      );
    }

    segments = parsed.pathname.split("/").filter(Boolean);
  } else {
    const withoutHost = value.replace(/^github\.com\//i, "");
    segments = withoutHost.split("/").filter(Boolean);
  }

  if (segments.length !== 2) {
    throw new RepositoryInputError(
      "Use a repository URL in the form github.com/owner/repo or owner/repo.",
    );
  }

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, "");

  const validOwner =
    /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner);
  const validRepo =
    repo.length <= 100 &&
    repo !== "." &&
    repo !== ".." &&
    /^[A-Za-z0-9._-]+$/.test(repo);

  if (!validOwner || !validRepo) {
    throw new RepositoryInputError(
      "The GitHub owner or repository name contains unsupported characters.",
    );
  }

  return { owner, repo };
}

export function analyzeRepositoryInput({
  repoUrl,
  owner,
  repo,
  defaultBranch,
  fileTree,
  packageJsonText,
}: AnalyzeRepositoryInput): RepositoryAnalysis {
  const packageJson = parsePackageJson(packageJsonText);
  const files = fileTree
    .filter((entry) => entry.type === "blob")
    .map((entry) => ({ ...entry, path: normalizePath(entry.path) }));
  const filePaths = new Set(files.map((entry) => entry.path.toLowerCase()));
  const scripts = toStringRecord(packageJson.scripts);
  const dependencies = collectDependencies(packageJson);

  const jsFiles = files.filter((entry) =>
    JAVASCRIPT_FILE_PATTERN.test(entry.path),
  ).length;
  const jsxFiles = files.filter((entry) => /\.jsx$/i.test(entry.path)).length;
  const tsFiles = files.filter((entry) =>
    TYPESCRIPT_FILE_PATTERN.test(entry.path),
  ).length;
  const tsxFiles = files.filter((entry) => /\.tsx$/i.test(entry.path)).length;

  const hasTsConfig = files.some((entry) =>
    /(^|\/)tsconfig(?:\.[^/]+)?\.json$/i.test(entry.path),
  );
  const hasTestFiles = files.some((entry) =>
    TEST_FILE_PATTERN.test(entry.path),
  );
  const hasTestScript =
    typeof scripts.test === "string" &&
    scripts.test.trim().length > 0 &&
    !/no test specified/i.test(scripts.test);
  const hasTests = hasTestFiles || hasTestScript;
  const hasBuildScript = hasRunnableScript(scripts, "build");
  const hasLintScript = hasRunnableScript(scripts, "lint");
  const hasTypecheckScript =
    hasRunnableScript(scripts, "typecheck") ||
    hasRunnableScript(scripts, "type-check");
  const hasTypeScriptDependency = dependencies.has("typescript");

  const packageManager = detectPackageManager(filePaths);
  const framework = detectFramework(dependencies, jsFiles + jsxFiles);
  const sourceText = files
    .filter(
      (entry) =>
        SOURCE_FILE_PATTERN.test(entry.path) &&
        typeof entry.content === "string",
    )
    .map((entry) => entry.content)
    .join("\n");
  const moduleSystem = detectModuleSystem(packageJson, files, sourceText);
  const hasDynamicRequire = DYNAMIC_REQUIRE_PATTERN.test(sourceText);
  const hasEval = EVAL_PATTERN.test(sourceText);
  const riskyRuntimePattern = hasDynamicRequire || hasEval;

  const riskFactors = buildRiskFactors({
    hasTsConfig,
    hasTests,
    hasTypecheckScript,
    moduleSystem,
    jsFiles: jsFiles + jsxFiles,
    hasDynamicRequire,
    hasEval,
  });

  const readinessScore = calculateReadinessScore({
    hasTests,
    hasTsConfig,
    hasTypeScriptDependency,
    hasBuildScript,
    hasLintScript,
    hasTypecheckScript,
    moduleSystem,
    jsFiles: jsFiles + jsxFiles,
    riskyRuntimePattern,
  });

  return {
    repoUrl,
    owner,
    repo,
    defaultBranch,
    packageManager,
    framework,
    moduleSystem,
    totalFiles: files.length,
    jsFiles,
    tsFiles,
    jsxFiles,
    tsxFiles,
    hasTsConfig,
    hasTests,
    hasBuildScript,
    hasLintScript,
    hasTypecheckScript,
    riskFactors,
    recommendedScopes: recommendScopes(files),
    readinessScore,
    difficulty: scoreToDifficulty(readinessScore),
  };
}

function parsePackageJson(packageJsonText: string): PackageJsonShape {
  try {
    const value: unknown = JSON.parse(packageJsonText);

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Package manifest is not an object.");
    }

    return value as PackageJsonShape;
  } catch {
    throw new Error("The repository package.json could not be parsed.");
  }
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function collectDependencies(packageJson: PackageJsonShape): Set<string> {
  const dependencyGroups = [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.peerDependencies,
    packageJson.optionalDependencies,
  ];

  return new Set(
    dependencyGroups.flatMap((group) =>
      Object.keys(toStringRecord(group)).map((name) => name.toLowerCase()),
    ),
  );
}

function hasRunnableScript(
  scripts: Record<string, string>,
  name: string,
): boolean {
  return typeof scripts[name] === "string" && scripts[name].trim().length > 0;
}

function detectPackageManager(filePaths: Set<string>): PackageManager {
  if (filePaths.has("pnpm-lock.yaml")) return "pnpm";
  if (filePaths.has("yarn.lock")) return "yarn";
  if (filePaths.has("package-lock.json")) return "npm";
  return "unknown";
}

function detectFramework(
  dependencies: Set<string>,
  javascriptFileCount: number,
): RepositoryFramework {
  if (dependencies.has("next")) return "next";
  if (dependencies.has("react")) return "react";
  if (dependencies.has("express")) return "express";
  if (dependencies.has("vite")) return "vite";
  if (javascriptFileCount > 0 || dependencies.size > 0) return "node";
  return "unknown";
}

function detectModuleSystem(
  packageJson: PackageJsonShape,
  files: RepositoryFileEntry[],
  sourceText: string,
): ModuleSystem {
  const hasEsm =
    packageJson.type === "module" ||
    files.some((entry) => /\.(?:mjs|mts)$/i.test(entry.path)) ||
    ESM_PATTERN.test(sourceText);
  const hasCommonJs =
    files.some((entry) => /\.(?:cjs|cts)$/i.test(entry.path)) ||
    COMMONJS_PATTERN.test(sourceText) ||
    DYNAMIC_REQUIRE_PATTERN.test(sourceText);

  if (hasEsm && hasCommonJs) return "mixed";
  if (hasEsm) return "esm";
  if (hasCommonJs) return "commonjs";
  return "unknown";
}

function buildRiskFactors({
  hasTsConfig,
  hasTests,
  hasTypecheckScript,
  moduleSystem,
  jsFiles,
  hasDynamicRequire,
  hasEval,
}: {
  hasTsConfig: boolean;
  hasTests: boolean;
  hasTypecheckScript: boolean;
  moduleSystem: ModuleSystem;
  jsFiles: number;
  hasDynamicRequire: boolean;
  hasEval: boolean;
}): RiskFactor[] {
  const risks: RiskFactor[] = [];

  if (!hasTsConfig) {
    risks.push({
      id: "missing-tsconfig",
      title: "TypeScript configuration missing",
      description:
        "No tsconfig was found, so compiler boundaries and strictness need to be established.",
      severity: "HIGH",
    });
  }

  if (!hasTests) {
    risks.push({
      id: "missing-tests",
      title: "No automated test signal",
      description:
        "No test files or runnable test script were detected to protect migration behavior.",
      severity: "HIGH",
    });
  }

  if (!hasTypecheckScript) {
    risks.push({
      id: "missing-typecheck",
      title: "No typecheck script",
      description:
        "The package scripts do not expose a repeatable typecheck validation gate.",
      severity: "MEDIUM",
    });
  }

  if (moduleSystem === "mixed") {
    risks.push({
      id: "mixed-modules",
      title: "Mixed module system",
      description:
        "CommonJS and ESM signals appear together and may require boundary-by-boundary migration.",
      severity: "HIGH",
    });
  }

  if (jsFiles > 100) {
    risks.push({
      id: "large-js-surface",
      title: "Large JavaScript surface",
      description: `${jsFiles} JavaScript and JSX files increase sequencing and review complexity.`,
      severity: "MEDIUM",
    });
  }

  if (hasDynamicRequire) {
    risks.push({
      id: "dynamic-require",
      title: "Dynamic require usage",
      description:
        "A sampled source file contains a non-literal require call that static typing cannot resolve safely.",
      severity: "HIGH",
    });
  }

  if (hasEval) {
    risks.push({
      id: "eval-usage",
      title: "Runtime eval usage",
      description:
        "A sampled source file uses eval, which requires manual review during migration.",
      severity: "HIGH",
    });
  }

  return risks;
}

function calculateReadinessScore({
  hasTests,
  hasTsConfig,
  hasTypeScriptDependency,
  hasBuildScript,
  hasLintScript,
  hasTypecheckScript,
  moduleSystem,
  jsFiles,
  riskyRuntimePattern,
}: {
  hasTests: boolean;
  hasTsConfig: boolean;
  hasTypeScriptDependency: boolean;
  hasBuildScript: boolean;
  hasLintScript: boolean;
  hasTypecheckScript: boolean;
  moduleSystem: ModuleSystem;
  jsFiles: number;
  riskyRuntimePattern: boolean;
}): number {
  let score = 50;

  score += hasTests ? 15 : -10;
  score += hasTsConfig ? 10 : -10;
  if (hasTypeScriptDependency) score += 10;
  if (hasBuildScript) score += 10;
  if (hasLintScript || hasTypecheckScript) score += 10;
  if (moduleSystem === "commonjs" || moduleSystem === "esm") score += 10;
  if (moduleSystem === "mixed") score -= 15;
  if (jsFiles > 100) score -= 10;
  if (riskyRuntimePattern) score -= 10;

  return Math.min(100, Math.max(0, score));
}

function scoreToDifficulty(score: number): AnalysisRiskLevel {
  if (score >= 75) return "LOW";
  if (score >= 45) return "MEDIUM";
  return "HIGH";
}

function recommendScopes(files: RepositoryFileEntry[]): RecommendedScope[] {
  const sourceFiles = files.filter(
    (entry) => entry.type === "blob" && SOURCE_FILE_PATTERN.test(entry.path),
  );
  const candidates = new Map<string, RepositoryFileEntry[]>();

  for (const preferred of PREFERRED_SCOPES) {
    const entries = sourceFiles.filter((entry) =>
      normalizePath(entry.path).toLowerCase().startsWith(`${preferred}/`),
    );

    if (entries.length > 0 && !entries.some((entry) => hasAvoidedSegment(entry.path))) {
      candidates.set(preferred, entries);
    }
  }

  if (candidates.size < 3) {
    for (const entry of sourceFiles) {
      const path = normalizePath(entry.path);
      const segments = path.split("/");
      const parent =
        segments[0]?.toLowerCase() === "src" && segments.length > 2
          ? segments.slice(0, 2).join("/")
          : segments.length > 1
            ? segments[0]
            : "";

      if (
        !parent ||
        candidates.has(parent) ||
        hasAvoidedSegment(parent) ||
        hasAvoidedSegment(path)
      ) {
        continue;
      }

      const entries = sourceFiles.filter((candidate) =>
        normalizePath(candidate.path).toLowerCase().startsWith(`${parent.toLowerCase()}/`),
      );

      if (entries.length > 0 && !entries.some((candidate) => hasAvoidedSegment(candidate.path))) {
        candidates.set(parent, entries);
      }
    }
  }

  return [...candidates.entries()]
    .map(([path, entries]) => {
      const hasRuntimeRisk = entries.some(
        (entry) =>
          typeof entry.content === "string" &&
          (DYNAMIC_REQUIRE_PATTERN.test(entry.content) ||
            EVAL_PATTERN.test(entry.content)),
      );
      const risk: AnalysisRiskLevel = hasRuntimeRisk
        ? "HIGH"
        : entries.length > 40
          ? "MEDIUM"
          : "LOW";

      return {
        path,
        estimatedFiles: entries.length,
        risk,
        reason: PREFERRED_SCOPES.includes(path as (typeof PREFERRED_SCOPES)[number])
          ? "Utility-oriented code is usually a contained, reviewable first migration."
          : "This directory provides a contained source boundary with no sensitive path signals.",
      };
    })
    .sort((left, right) => {
      const leftPreference = PREFERRED_SCOPES.indexOf(
        left.path as (typeof PREFERRED_SCOPES)[number],
      );
      const rightPreference = PREFERRED_SCOPES.indexOf(
        right.path as (typeof PREFERRED_SCOPES)[number],
      );
      const leftRank = leftPreference === -1 ? 99 : leftPreference;
      const rightRank = rightPreference === -1 ? 99 : rightPreference;

      return leftRank - rightRank || right.estimatedFiles - left.estimatedFiles;
    })
    .slice(0, 3);
}

function hasAvoidedSegment(path: string): boolean {
  return normalizePath(path)
    .toLowerCase()
    .split("/")
    .some((segment) => AVOIDED_SCOPE_SEGMENTS.has(segment));
}
