import type { RepositoryAnalysis } from "@codeshift/shared";
import type { RecipeFile } from "./recipe.js";

export interface DependencyInventoryItem {
  name: string;
  version: string;
  kind: "runtime" | "development" | "peer" | "optional";
}

export interface ImportEdge {
  from: string;
  to: string;
  kind: "static" | "commonjs" | "dynamic";
}

export interface RouteInventoryItem {
  file: string;
  method: string;
  path: string;
}

export interface RepositoryIntelligenceReport {
  repositoryId: string;
  languageBreakdown: Array<{ language: string; files: number; percentage: number }>;
  frameworks: string[];
  dependencies: DependencyInventoryItem[];
  importGraph: ImportEdge[];
  routes: RouteInventoryItem[];
  middleware: Array<{ file: string; expression: string }>;
  tests: string[];
  runtimeAssumptions: string[];
  environmentVariables: string[];
  unsupportedDependencies: Array<{ name: string; reason: string }>;
  readinessScore: number;
  risk: {
    score: number;
    level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    factors: Array<{ factor: string; points: number; explanation: string }>;
  };
  blockers: string[];
  recommendedRecipeSequence: string[];
}

interface PackageManifest {
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

const UNSUPPORTED_DEPENDENCIES: Readonly<Record<string, string>> = {
  "fibers": "Native fibers are not supported by current Node.js releases.",
  "node-sass": "Native node-sass should be replaced with the supported Sass implementation.",
  "request": "The request package is deprecated and no longer maintained.",
};

export function buildRepositoryIntelligence(
  repositoryId: string,
  analysis: RepositoryAnalysis,
  files: readonly RecipeFile[],
  packageJsonText = "{}",
): RepositoryIntelligenceReport {
  const manifest = parseManifest(packageJsonText);
  const dependencies = dependencyInventory(manifest);
  const sourceFiles = files.filter((file) => /\.[cm]?[jt]sx?$/i.test(file.path));
  const totalSourceFiles = Math.max(1, sourceFiles.length);
  const languageCounts = new Map<string, number>();

  sourceFiles.forEach((file) => {
    const extension = file.path.split(".").pop()?.toLowerCase() ?? "";
    const language =
      extension === "ts" || extension === "tsx" || extension === "mts"
        ? "TypeScript"
        : "JavaScript";
    languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
  });

  const importGraph = sourceFiles.flatMap(extractImports);
  const routes = sourceFiles.flatMap(extractRoutes);
  const middleware = sourceFiles.flatMap(extractMiddleware);
  const environmentVariables = [
    ...new Set(sourceFiles.flatMap(extractEnvironmentVariables)),
  ].sort();
  const tests = files
    .filter((file) => /(^|\/)(__tests__|tests?)\/|\.(test|spec)\.[cm]?[jt]sx?$/i.test(file.path))
    .map((file) => file.path)
    .sort();
  const unsupportedDependencies = dependencies
    .filter((dependency) => UNSUPPORTED_DEPENDENCIES[dependency.name])
    .map((dependency) => ({
      name: dependency.name,
      reason: UNSUPPORTED_DEPENDENCIES[dependency.name],
    }));
  const riskFactors = buildRiskFactors(
    analysis,
    sourceFiles.length,
    importGraph,
    routes,
    unsupportedDependencies,
  );
  const riskScore = Math.min(
    100,
    riskFactors.reduce((total, factor) => total + factor.points, 0),
  );
  const blockers = [
    ...unsupportedDependencies.map(
      (dependency) => `${dependency.name}: ${dependency.reason}`,
    ),
    ...(analysis.moduleSystem === "mixed"
      ? ["Mixed CommonJS and ESM boundaries require manual review."]
      : []),
    ...(!analysis.hasTests
      ? ["No automated test signal is available for behavioural validation."]
      : []),
  ];

  return {
    repositoryId,
    languageBreakdown: [...languageCounts.entries()].map(([language, count]) => ({
      language,
      files: count,
      percentage: Math.round((count / totalSourceFiles) * 100),
    })),
    frameworks: analysis.framework === "unknown" ? [] : [analysis.framework],
    dependencies,
    importGraph,
    routes,
    middleware,
    tests,
    runtimeAssumptions: [
      manifest.engines?.node
        ? `Node.js ${manifest.engines.node}`
        : "Node.js version is not declared.",
      `${analysis.moduleSystem} module system`,
      `${analysis.packageManager} package manager`,
    ],
    environmentVariables,
    unsupportedDependencies,
    readinessScore: analysis.readinessScore,
    risk: {
      score: riskScore,
      level: riskLevel(riskScore),
      factors: riskFactors,
    },
    blockers,
    recommendedRecipeSequence:
      analysis.jsFiles + analysis.jsxFiles > 0 ? ["js-to-ts"] : [],
  };
}

function parseManifest(text: string): PackageManifest {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as PackageManifest)
      : {};
  } catch {
    return {};
  }
}

function dependencyInventory(manifest: PackageManifest): DependencyInventoryItem[] {
  const groups: Array<
    [keyof PackageManifest, DependencyInventoryItem["kind"]]
  > = [
    ["dependencies", "runtime"],
    ["devDependencies", "development"],
    ["peerDependencies", "peer"],
    ["optionalDependencies", "optional"],
  ];

  return groups
    .flatMap(([key, kind]) =>
      Object.entries(manifest[key] ?? {}).map(([name, version]) => ({
        name,
        version,
        kind,
      })),
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}

function extractImports(file: RecipeFile): ImportEdge[] {
  if (!file.content) return [];
  const edges: ImportEdge[] = [];
  const patterns: Array<[RegExp, ImportEdge["kind"]]> = [
    [/\bimport(?:\s+[\s\S]*?\s+from\s+|\s*)["']([^"']+)["']/g, "static"],
    [/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g, "commonjs"],
    [/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, "dynamic"],
  ];

  for (const [pattern, kind] of patterns) {
    for (const match of file.content.matchAll(pattern)) {
      edges.push({ from: file.path, to: match[1], kind });
    }
  }
  return edges;
}

function extractRoutes(file: RecipeFile): RouteInventoryItem[] {
  if (!file.content) return [];
  return [...file.content.matchAll(/\b(?:app|router)\.(get|post|put|patch|delete|options|head)\s*\(\s*["']([^"']+)["']/gi)]
    .map((match) => ({
      file: file.path,
      method: match[1].toUpperCase(),
      path: match[2],
    }));
}

function extractMiddleware(
  file: RecipeFile,
): Array<{ file: string; expression: string }> {
  if (!file.content) return [];
  return [...file.content.matchAll(/\b(?:app|router)\.use\s*\(\s*([^\n,)]+)/g)]
    .map((match) => ({ file: file.path, expression: match[1].trim() }));
}

function extractEnvironmentVariables(file: RecipeFile): string[] {
  if (!file.content) return [];
  return [...file.content.matchAll(/\bprocess\.env\.([A-Z][A-Z0-9_]*)/g)].map(
    (match) => match[1],
  );
}

function buildRiskFactors(
  analysis: RepositoryAnalysis,
  sourceFileCount: number,
  imports: readonly ImportEdge[],
  routes: readonly RouteInventoryItem[],
  unsupportedDependencies: readonly { name: string; reason: string }[],
) {
  const factors: Array<{
    factor: string;
    points: number;
    explanation: string;
  }> = [];

  if (!analysis.hasTests) {
    factors.push({ factor: "missing-tests", points: 25, explanation: "No automated test signal was detected." });
  }
  if (analysis.moduleSystem === "mixed") {
    factors.push({ factor: "runtime-change", points: 20, explanation: "Mixed module boundaries increase runtime risk." });
  }
  if (sourceFileCount > 100) {
    factors.push({ factor: "affected-files", points: 15, explanation: `${sourceFileCount} source files increase review scope.` });
  }
  if (imports.length > 200) {
    factors.push({ factor: "dependency-fan-in", points: 15, explanation: "The import graph contains more than 200 edges." });
  }
  if (routes.length > 0) {
    factors.push({ factor: "api-surface", points: 10, explanation: `${routes.length} HTTP routes require parity validation.` });
  }
  if (unsupportedDependencies.length > 0) {
    factors.push({ factor: "unsupported-dependencies", points: 25, explanation: `${unsupportedDependencies.length} unsupported dependencies were detected.` });
  }
  if (factors.length === 0) {
    factors.push({ factor: "baseline-change", points: 10, explanation: "Any source migration requires review and validation." });
  }

  return factors;
}

function riskLevel(score: number): RepositoryIntelligenceReport["risk"]["level"] {
  if (score >= 85) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}
