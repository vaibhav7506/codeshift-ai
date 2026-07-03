import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  analyzeRepositoryInput,
  type RepositoryFileEntry,
} from "@codeshift/analyzer/runtime";
import type {
  MigrationPlan,
  RepositoryAnalysis,
} from "@codeshift/shared";

const ARTIFACT_DIRECTORY = ".codeshift-ai";
const ANALYSIS_FILE = "analysis.json";
const PLAN_FILE = "migration-plan.json";
const MAX_SAMPLE_BYTES = 128_000;
const MAX_SOURCE_SAMPLES = 50;

const IGNORED_DIRECTORIES = new Set([
  ".codeshift-ai",
  ".git",
  ".hg",
  ".next",
  ".svn",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "vendor",
]);

const SOURCE_FILE_PATTERN = /\.(?:js|jsx|mjs|cjs)$/i;
const PREFERRED_SAMPLE_SEGMENTS = new Set(["src", "utils", "lib", "helpers"]);

export class LocalRepositoryError extends Error {
  constructor(
    readonly code:
      | "PACKAGE_JSON_MISSING"
      | "PACKAGE_JSON_UNREADABLE"
      | "INVALID_ANALYSIS_ARTIFACT",
    message: string,
  ) {
    super(message);
    this.name = "LocalRepositoryError";
  }
}

export async function analyzeLocalRepository(
  cwd: string,
): Promise<RepositoryAnalysis> {
  const root = resolve(cwd);
  const packageJsonPath = join(root, "package.json");
  let packageJsonText: string;

  try {
    packageJsonText = await readFile(packageJsonPath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new LocalRepositoryError(
        "PACKAGE_JSON_MISSING",
        "No package.json was found in the current directory.",
      );
    }

    throw new LocalRepositoryError(
      "PACKAGE_JSON_UNREADABLE",
      "The current repository package.json could not be read.",
    );
  }

  const fileTree = await scanRepository(root);
  await addSourceSamples(root, fileTree);

  return analyzeRepositoryInput({
    repoUrl: pathToFileURL(root).href,
    owner: "local",
    repo: basename(root),
    defaultBranch: await detectLocalBranch(root),
    fileTree,
    packageJsonText,
  });
}

export async function writeAnalysisArtifact(
  cwd: string,
  analysis: RepositoryAnalysis,
): Promise<string> {
  return writeArtifact(cwd, ANALYSIS_FILE, analysis);
}

export async function writeMigrationPlanArtifact(
  cwd: string,
  plan: MigrationPlan,
): Promise<string> {
  return writeArtifact(cwd, PLAN_FILE, plan);
}

export async function readAnalysisArtifact(
  cwd: string,
): Promise<RepositoryAnalysis | null> {
  const artifactPath = join(resolve(cwd), ARTIFACT_DIRECTORY, ANALYSIS_FILE);
  let text: string;

  try {
    text = await readFile(artifactPath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }

    throw new LocalRepositoryError(
      "INVALID_ANALYSIS_ARTIFACT",
      "The existing analysis artifact could not be read.",
    );
  }

  try {
    const value: unknown = JSON.parse(text);

    if (!isRepositoryAnalysis(value)) {
      throw new Error("Invalid analysis shape.");
    }

    return value;
  } catch {
    throw new LocalRepositoryError(
      "INVALID_ANALYSIS_ARTIFACT",
      "The existing .codeshift-ai/analysis.json is not valid.",
    );
  }
}

async function scanRepository(root: string): Promise<RepositoryFileEntry[]> {
  const entries: RepositoryFileEntry[] = [];
  await walkDirectory(root, root, entries);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function walkDirectory(
  root: string,
  currentDirectory: string,
  entries: RepositoryFileEntry[],
): Promise<void> {
  const directoryEntries = await readdir(currentDirectory, {
    withFileTypes: true,
  });
  directoryEntries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of directoryEntries) {
    if (entry.isSymbolicLink()) continue;

    const absolutePath = join(currentDirectory, entry.name);
    const relativePath = toPosixPath(relative(root, absolutePath));

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
      await walkDirectory(root, absolutePath, entries);
      continue;
    }

    if (!entry.isFile()) continue;

    try {
      const fileStats = await stat(absolutePath);
      entries.push({
        path: relativePath,
        type: "blob",
        size: fileStats.size,
      });
    } catch {
      // Files that disappear or become unreadable during traversal are skipped.
    }
  }
}

async function addSourceSamples(
  root: string,
  entries: RepositoryFileEntry[],
): Promise<void> {
  const samples = entries
    .filter(
      (entry) =>
        entry.type === "blob" &&
        SOURCE_FILE_PATTERN.test(entry.path) &&
        (entry.size ?? 0) <= MAX_SAMPLE_BYTES,
    )
    .sort((left, right) => {
      const leftPreferred = pathHasPreferredSegment(left.path);
      const rightPreferred = pathHasPreferredSegment(right.path);

      return (
        Number(rightPreferred) - Number(leftPreferred) ||
        (left.size ?? 0) - (right.size ?? 0) ||
        left.path.localeCompare(right.path)
      );
    })
    .slice(0, MAX_SOURCE_SAMPLES);

  await Promise.all(
    samples.map(async (entry) => {
      try {
        entry.content = await readFile(
          join(root, ...entry.path.split("/")),
          "utf8",
        );
      } catch {
        // Content sampling is optional; tree analysis can continue without it.
      }
    }),
  );
}

async function detectLocalBranch(root: string): Promise<string> {
  try {
    const head = (await readFile(join(root, ".git", "HEAD"), "utf8")).trim();
    const match = /^ref:\s+refs\/heads\/(.+)$/.exec(head);
    return match?.[1] ?? "detached";
  } catch {
    return "local";
  }
}

async function writeArtifact(
  cwd: string,
  filename: typeof ANALYSIS_FILE | typeof PLAN_FILE,
  value: RepositoryAnalysis | MigrationPlan,
): Promise<string> {
  const root = resolve(cwd);
  const artifactDirectory = join(root, ARTIFACT_DIRECTORY);
  const artifactPath = join(artifactDirectory, filename);

  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");

  return toPosixPath(relative(root, artifactPath));
}

function isRepositoryAnalysis(value: unknown): value is RepositoryAnalysis {
  if (!isRecord(value)) return false;

  return (
    typeof value.repoUrl === "string" &&
    typeof value.owner === "string" &&
    typeof value.repo === "string" &&
    typeof value.defaultBranch === "string" &&
    typeof value.packageManager === "string" &&
    typeof value.framework === "string" &&
    typeof value.moduleSystem === "string" &&
    typeof value.totalFiles === "number" &&
    typeof value.jsFiles === "number" &&
    typeof value.tsFiles === "number" &&
    typeof value.jsxFiles === "number" &&
    typeof value.tsxFiles === "number" &&
    typeof value.hasTsConfig === "boolean" &&
    typeof value.hasTests === "boolean" &&
    typeof value.hasBuildScript === "boolean" &&
    typeof value.hasLintScript === "boolean" &&
    typeof value.hasTypecheckScript === "boolean" &&
    Array.isArray(value.riskFactors) &&
    Array.isArray(value.recommendedScopes) &&
    typeof value.readinessScore === "number" &&
    (value.difficulty === "LOW" ||
      value.difficulty === "MEDIUM" ||
      value.difficulty === "HIGH")
  );
}

function pathHasPreferredSegment(path: string): boolean {
  return path
    .toLowerCase()
    .split("/")
    .some((segment) => PREFERRED_SAMPLE_SEGMENTS.has(segment));
}

function toPosixPath(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
