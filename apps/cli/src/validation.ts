import { spawn } from "node:child_process";
import {
  lstat,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import {
  join,
  relative,
  resolve,
} from "node:path";
import type {
  PackageManager,
  ValidationResult,
} from "@codeshift/shared";

const ARTIFACT_DIRECTORY = ".codeshift-ai";
const RESULT_FILE = "validation-result.json";
const LOG_FILE = "validation-logs.txt";
const VALIDATION_SCRIPTS = ["test", "build", "typecheck", "lint"] as const;

type ValidationScript = (typeof VALIDATION_SCRIPTS)[number];
type ValidationPackageManager = Exclude<PackageManager, "unknown">;

interface PackageJson {
  scripts: Partial<Record<ValidationScript, string>>;
}

interface PackageManagerInvocation {
  executable: string;
  argumentsPrefix: string[];
}

interface PackageManagerSelection {
  packageManager: ValidationPackageManager;
  warning: string | null;
}

export interface ValidationRunResult {
  packageManager: ValidationPackageManager;
  warnings: string[];
  results: ValidationResult[];
  overallPassed: boolean;
  resultArtifactPath: string;
  logsArtifactPath: string;
}

export class ValidationRunnerError extends Error {
  constructor(
    readonly code:
      | "PACKAGE_JSON_MISSING"
      | "PACKAGE_JSON_INVALID"
      | "PACKAGE_MANAGER_UNDETECTED"
      | "UNSAFE_ARTIFACT_PATH",
    message: string,
  ) {
    super(message);
    this.name = "ValidationRunnerError";
  }
}

export async function runLocalValidation(
  cwd: string,
): Promise<ValidationRunResult> {
  const root = resolve(cwd);
  const packageJson = await readPackageJson(root);
  const packageManagerSelection = await detectPackageManagerSelection(root);
  const packageManager = packageManagerSelection.packageManager;
  const warnings = packageManagerSelection.warning
    ? [packageManagerSelection.warning]
    : [];

  await assertArtifactPathsAreSafe(root);

  const results: ValidationResult[] = [];

  for (const script of VALIDATION_SCRIPTS) {
    const command = formatCommand(packageManager, script);

    if (typeof packageJson.scripts[script] !== "string") {
      results.push({
        command,
        status: "SKIPPED",
        logs: `Script "${script}" is not defined in package.json.`,
      });
      continue;
    }

    results.push(
      await executeScript(root, packageManager, script, command),
    );
  }

  const overallPassed = results.every((result) => result.status !== "FAILED");
  const artifactDirectory = join(root, ARTIFACT_DIRECTORY);
  const resultPath = join(artifactDirectory, RESULT_FILE);
  const logsPath = join(artifactDirectory, LOG_FILE);

  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(
    resultPath,
    `${JSON.stringify(results, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    logsPath,
    formatValidationLogs(packageManager, results, overallPassed, warnings),
    "utf8",
  );

  return {
    packageManager,
    warnings,
    results,
    overallPassed,
    resultArtifactPath: toPosixPath(relative(root, resultPath)),
    logsArtifactPath: toPosixPath(relative(root, logsPath)),
  };
}

async function readPackageJson(root: string): Promise<PackageJson> {
  const packageJsonPath = join(root, "package.json");
  const stats = await lstatIfExists(packageJsonPath);

  if (!stats) {
    throw new ValidationRunnerError(
      "PACKAGE_JSON_MISSING",
      "No package.json was found in the current directory.",
    );
  }

  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new ValidationRunnerError(
      "PACKAGE_JSON_INVALID",
      "package.json must be a regular file in the current directory.",
    );
  }

  try {
    const value: unknown = JSON.parse(await readFile(packageJsonPath, "utf8"));

    if (!isRecord(value)) throw new Error("Invalid package.json.");

    const scripts = isRecord(value.scripts) ? value.scripts : {};
    const detectedScripts: PackageJson["scripts"] = {};

    for (const script of VALIDATION_SCRIPTS) {
      if (typeof scripts[script] === "string") {
        detectedScripts[script] = scripts[script];
      }
    }

    return { scripts: detectedScripts };
  } catch {
    throw new ValidationRunnerError(
      "PACKAGE_JSON_INVALID",
      "package.json is not valid JSON.",
    );
  }
}

export async function detectPackageManager(
  root: string,
): Promise<ValidationPackageManager> {
  return (await detectPackageManagerSelection(root)).packageManager;
}

async function detectPackageManagerSelection(
  root: string,
): Promise<PackageManagerSelection> {
  const candidates: ReadonlyArray<
    readonly [filename: string, packageManager: ValidationPackageManager]
  > = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["package-lock.json", "npm"],
  ];

  for (const [filename, packageManager] of candidates) {
    const stats = await lstatIfExists(join(root, filename));
    if (stats?.isFile() && !stats.isSymbolicLink()) {
      return { packageManager, warning: null };
    }
  }

  const packageJsonStats = await lstatIfExists(join(root, "package.json"));

  if (!packageJsonStats) {
    throw new ValidationRunnerError(
      "PACKAGE_JSON_MISSING",
      "No package.json was found in the current directory.",
    );
  }

  if (
    packageJsonStats.isSymbolicLink() ||
    !packageJsonStats.isFile()
  ) {
    throw new ValidationRunnerError(
      "PACKAGE_JSON_INVALID",
      "package.json must be a regular file in the current directory.",
    );
  }

  return {
    packageManager: "npm",
    warning:
      "No supported lockfile was found; defaulting to npm because package.json exists.",
  };
}

async function executeScript(
  root: string,
  packageManager: ValidationPackageManager,
  script: ValidationScript,
  command: string,
): Promise<ValidationResult> {
  const startedAt = performance.now();
  const invocation = resolvePackageManagerInvocation(packageManager);

  return new Promise((resolveResult) => {
    const child = spawn(
      invocation.executable,
      [...invocation.argumentsPrefix, "run", script],
      {
        cwd: root,
        env: process.env,
        shell: false,
        windowsHide: true,
      },
    );
    let logs = "";
    let settled = false;

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      logs += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      logs += chunk;
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      resolveResult({
        command,
        status: "FAILED",
        logs: appendLog(logs, `Unable to start command: ${error.message}`),
        durationMs: elapsedMilliseconds(startedAt),
      });
    });

    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;

      if (code === 0) {
        resolveResult({
          command,
          status: "PASSED",
          logs,
          durationMs: elapsedMilliseconds(startedAt),
        });
        return;
      }

      const reason = signal
        ? `Command ended after receiving signal ${signal}.`
        : `Command exited with code ${code ?? "unknown"}.`;
      resolveResult({
        command,
        status: "FAILED",
        logs: appendLog(logs, reason),
        durationMs: elapsedMilliseconds(startedAt),
      });
    });
  });
}

function resolvePackageManagerInvocation(
  packageManager: ValidationPackageManager,
): PackageManagerInvocation {
  if (process.platform !== "win32") {
    return {
      executable: packageManager,
      argumentsPrefix: [],
    };
  }

  return {
    executable: process.env.ComSpec ?? process.env.COMSPEC ?? "cmd.exe",
    argumentsPrefix: ["/d", "/s", "/c", `${packageManager}.cmd`],
  };
}

function formatCommand(
  packageManager: ValidationPackageManager,
  script: ValidationScript,
): string {
  return `${packageManager} run ${script}`;
}

function formatValidationLogs(
  packageManager: ValidationPackageManager,
  results: ValidationResult[],
  overallPassed: boolean,
  warnings: string[] = [],
): string {
  const sections = results.map((result) => {
    const duration =
      result.durationMs === undefined ? "" : `\nDuration: ${result.durationMs}ms`;
    return [
      `[${result.status}] ${result.command}`,
      `Status: ${result.status}${duration}`,
      "",
      result.logs || "(no output)",
    ].join("\n");
  });

  return [
    "CodeShift AI validation logs",
    `Package manager: ${packageManager}`,
    `Overall: ${overallPassed ? "PASSED" : "FAILED"}`,
    ...(warnings.length > 0
      ? ["Warnings:", ...warnings.map((warning) => `- ${warning}`)]
      : []),
    "",
    sections.join("\n\n----------------------------------------------------------\n\n"),
    "",
  ].join("\n");
}

async function assertArtifactPathsAreSafe(root: string): Promise<void> {
  const directoryPath = join(root, ARTIFACT_DIRECTORY);
  const directoryStats = await lstatIfExists(directoryPath);

  if (
    directoryStats &&
    (directoryStats.isSymbolicLink() || !directoryStats.isDirectory())
  ) {
    throw new ValidationRunnerError(
      "UNSAFE_ARTIFACT_PATH",
      `${ARTIFACT_DIRECTORY} must be a regular directory inside the repository.`,
    );
  }

  if (!directoryStats) return;

  for (const filename of [RESULT_FILE, LOG_FILE]) {
    const artifactPath = join(directoryPath, filename);
    const stats = await lstatIfExists(artifactPath);

    if (stats && (stats.isSymbolicLink() || !stats.isFile())) {
      throw new ValidationRunnerError(
        "UNSAFE_ARTIFACT_PATH",
        `${ARTIFACT_DIRECTORY}/${filename} must be a regular file inside the repository.`,
      );
    }
  }
}

async function lstatIfExists(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function appendLog(logs: string, message: string): string {
  if (!logs) return message;
  return `${logs}${logs.endsWith("\n") ? "" : "\n"}${message}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPosixPath(path: string): string {
  return path.replaceAll("\\", "/");
}
