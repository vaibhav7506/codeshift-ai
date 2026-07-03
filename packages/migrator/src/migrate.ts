import { createRequire } from "node:module";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createTwoFilesPatch } from "diff";
import * as jsonc from "jsonc-parser";
import type { MigrationSummary } from "@codeshift/shared";

const ARTIFACT_DIRECTORY = ".codeshift-ai";
const PATCH_ARTIFACT = `${ARTIFACT_DIRECTORY}/patch.diff`;
const SUMMARY_ARTIFACT = `${ARTIFACT_DIRECTORY}/migration-summary.json`;
const IGNORED_DIRECTORIES = new Set([
  ".codeshift-ai",
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "vendor",
]);

const DEFAULT_TSCONFIG = {
  compilerOptions: {
    target: "ES2020",
    module: "ESNext",
    moduleResolution: "Bundler",
    strict: false,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    noEmit: true,
    allowJs: true,
    checkJs: false,
  },
  include: ["src/**/*"],
};

interface FileMigration {
  sourcePath: string;
  targetPath: string;
  sourceRelativePath: string;
  targetRelativePath: string;
  before: string;
  after: string;
}

interface TsconfigMigration {
  path: string;
  before: string | null;
  after: string;
}

interface TransformResult {
  code: string;
  warnings: string[];
}

interface PrettierModule {
  format(
    source: string,
    options: { filepath: string; parser: "typescript" },
  ): string | Promise<string>;
}

export interface MigrateJavaScriptToTypeScriptInput {
  rootDir: string;
  selectedScope: string;
}

export interface MigrationExecutionResult {
  summary: MigrationSummary;
  patch: string;
  patchArtifactPath: typeof PATCH_ARTIFACT;
  summaryArtifactPath: typeof SUMMARY_ARTIFACT;
}

export class MigrationExecutionError extends Error {
  constructor(
    readonly code:
      | "INVALID_SCOPE"
      | "SCOPE_NOT_FOUND"
      | "SCOPE_NOT_DIRECTORY"
      | "NO_SOURCE_FILES"
      | "UNSAFE_ARTIFACT_PATH",
    message: string,
  ) {
    super(message);
    this.name = "MigrationExecutionError";
  }
}

export async function migrateJavaScriptToTypeScript({
  rootDir,
  selectedScope,
}: MigrateJavaScriptToTypeScriptInput): Promise<MigrationExecutionResult> {
  const root = await realpath(resolve(rootDir));
  const scope = normalizeScope(selectedScope);
  const scopePath = resolve(root, ...scope.split("/"));

  assertPathInsideRoot(root, scopePath);
  await assertScopeIsSafeDirectory(root, scope);
  await assertArtifactPathsAreSafe(root);

  const candidates = await collectJavaScriptFiles(scopePath);

  if (candidates.length === 0) {
    throw new MigrationExecutionError(
      "NO_SOURCE_FILES",
      `No .js or .jsx files were found in "${scope}".`,
    );
  }

  const warnings: string[] = [];
  const prettier = await loadRepositoryPrettier(root);
  const migrations: FileMigration[] = [];

  for (const sourcePath of candidates) {
    const sourceRelativePath = toPosixPath(relative(root, sourcePath));
    const extension = extname(sourcePath).toLowerCase();
    const before = await readFile(sourcePath, "utf8");

    if (extension === ".jsx" && !containsJsx(before)) {
      warnings.push(
        `${sourceRelativePath}: JSX was not detected, so the .jsx file was left unchanged.`,
      );
      continue;
    }

    if (extension === ".js" && containsJsx(before)) {
      warnings.push(
        `${sourceRelativePath}: JSX was detected in a .js file, so it was left unchanged rather than creating invalid .ts syntax.`,
      );
      continue;
    }

    const targetExtension = extension === ".jsx" ? ".tsx" : ".ts";
    const targetPath = sourcePath.slice(0, -extension.length) + targetExtension;
    const targetRelativePath = toPosixPath(relative(root, targetPath));

    if (await lstatIfExists(targetPath)) {
      warnings.push(
        `${sourceRelativePath}: ${targetRelativePath} already exists, so the source file was left unchanged.`,
      );
      continue;
    }

    const transformed = transformCommonJs(before, sourceRelativePath);
    warnings.push(...transformed.warnings);
    let after = transformed.code;

    if (prettier) {
      try {
        after = await prettier.format(after, {
          filepath: targetPath,
          parser: "typescript",
        });
      } catch {
        warnings.push(
          `${sourceRelativePath}: Prettier could not format the converted file; original formatting was preserved.`,
        );
        after = transformed.code;
      }
    }

    migrations.push({
      sourcePath,
      targetPath,
      sourceRelativePath,
      targetRelativePath,
      before,
      after,
    });
  }

  const tsconfig = await prepareTsconfigMigration(root, warnings);
  const patch = buildPatch(migrations, tsconfig);
  const changedFiles = [
    ...migrations.map((migration) => migration.targetRelativePath),
    ...(tsconfig ? ["tsconfig.json"] : []),
  ].sort((left, right) => left.localeCompare(right));
  const summary: MigrationSummary = {
    target: "JS_TO_TS",
    selectedScope: scope,
    changedFiles,
    warnings,
    tsconfigChanged: tsconfig !== null,
    createdAt: new Date().toISOString(),
  };

  await applyMigration(root, migrations, tsconfig, patch, summary);

  return {
    summary,
    patch,
    patchArtifactPath: PATCH_ARTIFACT,
    summaryArtifactPath: SUMMARY_ARTIFACT,
  };
}

export function transformCommonJs(
  source: string,
  relativePath = "source.js",
): TransformResult {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/);
  const scannableLines = stripStringsAndComments(source).split(/\r?\n/);
  const warnings: string[] = [];

  const converted = lines.map((line, index) => {
    const scannableLine = scannableLines[index] ?? "";
    const importMatch = line.match(
      /^(\s*)const\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*(["'])([^"'\r\n]+)\3\s*\)\s*;?\s*$/,
    );

    if (importMatch && /\brequire\s*\(/.test(scannableLine)) {
      return `${importMatch[1]}import ${importMatch[2]} from ${importMatch[3]}${importMatch[4]}${importMatch[3]};`;
    }

    const defaultExportMatch = line.match(
      /^(\s*)module\.exports\s*=\s*([A-Za-z_$][\w$]*)\s*;?\s*$/,
    );

    if (
      defaultExportMatch &&
      /\bmodule\.exports\b/.test(scannableLine)
    ) {
      return `${defaultExportMatch[1]}export default ${defaultExportMatch[2]};`;
    }

    const namedExportMatch = line.match(
      /^(\s*)exports\.([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*;?\s*$/,
    );

    if (
      namedExportMatch &&
      namedExportMatch[2] === namedExportMatch[3] &&
      /\bexports\.[A-Za-z_$]/.test(scannableLine)
    ) {
      return `${namedExportMatch[1]}export { ${namedExportMatch[2]} };`;
    }

    if (
      /\brequire\s*\(|\bmodule\.exports\b|\bexports\.[A-Za-z_$]/.test(
        scannableLine,
      )
    ) {
      warnings.push(
        `${relativePath}: complex CommonJS syntax on line ${index + 1} was left unchanged.`,
      );
    }

    return line;
  });

  return {
    code: converted.join(newline),
    warnings,
  };
}

function normalizeScope(value: string): string {
  const normalized = value
    .trim()
    .replaceAll("\\", "/")
    .replace(/\/+/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/$/, "");
  const segments = normalized.split("/");

  if (
    !normalized ||
    normalized === "." ||
    isAbsolute(value) ||
    /^[A-Za-z]:/.test(normalized) ||
    /[\0\r\n]/.test(normalized) ||
    segments.some((segment) => segment === ".." || segment === "")
  ) {
    throw new MigrationExecutionError(
      "INVALID_SCOPE",
      "The migration path must be a safe repository-relative directory.",
    );
  }

  return normalized;
}

function assertPathInsideRoot(root: string, candidate: string): void {
  const relativePath = relative(root, candidate);

  if (
    !relativePath ||
    relativePath === ".." ||
    relativePath.startsWith(`..\\`) ||
    relativePath.startsWith("../") ||
    isAbsolute(relativePath)
  ) {
    throw new MigrationExecutionError(
      "INVALID_SCOPE",
      "The migration path must stay inside the current repository.",
    );
  }
}

async function assertScopeIsSafeDirectory(
  root: string,
  scope: string,
): Promise<void> {
  let current = root;

  try {
    for (const segment of scope.split("/")) {
      current = join(current, segment);
      const stats = await lstat(current);

      if (stats.isSymbolicLink()) {
        throw new MigrationExecutionError(
          "INVALID_SCOPE",
          "Migration paths cannot traverse symbolic links.",
        );
      }
    }
  } catch (error) {
    if (error instanceof MigrationExecutionError) throw error;
    throw new MigrationExecutionError(
      "SCOPE_NOT_FOUND",
      `The migration path "${scope}" does not exist.`,
    );
  }

  const stats = await lstat(current);

  if (!stats.isDirectory()) {
    throw new MigrationExecutionError(
      "SCOPE_NOT_DIRECTORY",
      `The migration path "${scope}" must be a directory.`,
    );
  }

  const resolvedScope = await realpath(current);
  assertPathInsideRoot(root, resolvedScope);
}

async function collectJavaScriptFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (entry.isSymbolicLink()) continue;

    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        files.push(...(await collectJavaScriptFiles(entryPath)));
      }
      continue;
    }

    const extension = extname(entry.name).toLowerCase();
    if (entry.isFile() && (extension === ".js" || extension === ".jsx")) {
      files.push(entryPath);
    }
  }

  return files;
}

function containsJsx(source: string): boolean {
  const scannableSource = stripStringsAndComments(source);

  return (
    /<>[\s\S]*?<\/>/.test(scannableSource) ||
    /<[A-Za-z][\w.-]*(?:\s+[^<>]*?)?\s*\/>/.test(scannableSource) ||
    /<[A-Za-z][\w.-]*(?:\s+[^<>]*?)?>[\s\S]*?<\/[A-Za-z][\w.-]*\s*>/.test(
      scannableSource,
    )
  );
}

function stripStringsAndComments(source: string): string {
  let result = "";
  let state:
    | "normal"
    | "single"
    | "double"
    | "template"
    | "line-comment"
    | "block-comment" = "normal";

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? "";
    const next = source[index + 1] ?? "";

    if (state === "normal") {
      if (character === "/" && next === "/") {
        result += "  ";
        state = "line-comment";
        index += 1;
      } else if (character === "/" && next === "*") {
        result += "  ";
        state = "block-comment";
        index += 1;
      } else if (character === "'") {
        result += " ";
        state = "single";
      } else if (character === '"') {
        result += " ";
        state = "double";
      } else if (character === "`") {
        result += " ";
        state = "template";
      } else {
        result += character;
      }
      continue;
    }

    if (state === "line-comment") {
      if (character === "\n" || character === "\r") {
        result += character;
        state = "normal";
      } else {
        result += " ";
      }
      continue;
    }

    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        result += "  ";
        state = "normal";
        index += 1;
      } else {
        result += character === "\n" || character === "\r" ? character : " ";
      }
      continue;
    }

    if (character === "\\") {
      result += " ";
      if (next) {
        result += next === "\n" || next === "\r" ? next : " ";
        index += 1;
      }
      continue;
    }

    const closesState =
      (state === "single" && character === "'") ||
      (state === "double" && character === '"') ||
      (state === "template" && character === "`");
    result += character === "\n" || character === "\r" ? character : " ";

    if (closesState) {
      state = "normal";
    }
  }

  return result;
}

async function loadRepositoryPrettier(
  root: string,
): Promise<PrettierModule | null> {
  try {
    const repositoryRequire = createRequire(join(root, "package.json"));
    const prettierPath = repositoryRequire.resolve("prettier");
    const imported = (await import(pathToFileURL(prettierPath).href)) as {
      default?: unknown;
      format?: unknown;
    };
    const candidate =
      typeof imported.format === "function" ? imported : imported.default;

    return isPrettierModule(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

async function prepareTsconfigMigration(
  root: string,
  warnings: string[],
): Promise<TsconfigMigration | null> {
  const tsconfigPath = join(root, "tsconfig.json");
  const tsconfigStats = await lstatIfExists(tsconfigPath);

  if (!tsconfigStats) {
    return {
      path: tsconfigPath,
      before: null,
      after: `${JSON.stringify(DEFAULT_TSCONFIG, null, 2)}\n`,
    };
  }

  if (tsconfigStats.isSymbolicLink() || !tsconfigStats.isFile()) {
    warnings.push(
      "tsconfig.json is not a regular repository file, so it was left unchanged.",
    );
    return null;
  }

  const before = await readFile(tsconfigPath, "utf8");
  const errors: jsonc.ParseError[] = [];
  const parsed = jsonc.parse(before, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  }) as unknown;

  if (
    errors.length > 0 ||
    !isRecord(parsed)
  ) {
    warnings.push(
      "tsconfig.json could not be safely parsed, so it was left unchanged.",
    );
    return null;
  }

  const compilerOptions = parsed.compilerOptions;

  if (compilerOptions !== undefined && !isRecord(compilerOptions)) {
    warnings.push(
      "tsconfig.json has a non-object compilerOptions value, so it was left unchanged.",
    );
    return null;
  }

  const formattingOptions: jsonc.FormattingOptions = {
    insertSpaces: !before.includes("\t"),
    tabSize: detectIndentSize(before),
    eol: before.includes("\r\n") ? "\r\n" : "\n",
  };
  let after = before;

  if (!isRecord(compilerOptions)) {
    after = jsonc.applyEdits(
      after,
      jsonc.modify(
        after,
        ["compilerOptions"],
        { allowJs: true, checkJs: false },
        { formattingOptions },
      ),
    );
  } else {
    if (compilerOptions.allowJs === undefined) {
      after = jsonc.applyEdits(
        after,
        jsonc.modify(after, ["compilerOptions", "allowJs"], true, {
          formattingOptions,
        }),
      );
    }

    if (compilerOptions.checkJs === undefined) {
      after = jsonc.applyEdits(
        after,
        jsonc.modify(after, ["compilerOptions", "checkJs"], false, {
          formattingOptions,
        }),
      );
    }
  }

  return after === before
    ? null
    : { path: tsconfigPath, before, after };
}

function detectIndentSize(source: string): number {
  const match = source.match(/\n( +)"/);
  return match?.[1]?.length ?? 2;
}

function buildPatch(
  migrations: FileMigration[],
  tsconfig: TsconfigMigration | null,
): string {
  const patches: string[] = migrations.map((migration) => {
    const contentChanged = migration.before !== migration.after;
    const header = [
      `diff --git a/${migration.sourceRelativePath} b/${migration.targetRelativePath}`,
      ...(!contentChanged ? ["similarity index 100%"] : []),
      `rename from ${migration.sourceRelativePath}`,
      `rename to ${migration.targetRelativePath}`,
    ].join("\n");
    const body = contentChanged
      ? stripPatchSeparator(
          createTwoFilesPatch(
            `a/${migration.sourceRelativePath}`,
            `b/${migration.targetRelativePath}`,
            migration.before,
            migration.after,
            "",
            "",
            { context: 3 },
          ),
        )
      : "";
    return body ? `${header}\n${body.trimEnd()}` : header;
  });

  if (tsconfig) {
    const created = tsconfig.before === null;
    const header = [
      "diff --git a/tsconfig.json b/tsconfig.json",
      ...(created ? ["new file mode 100644"] : []),
    ].join("\n");
    const body = stripPatchSeparator(
      createTwoFilesPatch(
        created ? "/dev/null" : "a/tsconfig.json",
        "b/tsconfig.json",
        tsconfig.before ?? "",
        tsconfig.after,
        "",
        "",
        { context: 3 },
      ),
    );
    patches.push(`${header}\n${body.trimEnd()}`);
  }

  return patches.length > 0 ? `${patches.join("\n\n")}\n` : "";
}

function stripPatchSeparator(patch: string): string {
  return patch.replace(/^=+\r?\n/, "");
}

async function applyMigration(
  root: string,
  migrations: FileMigration[],
  tsconfig: TsconfigMigration | null,
  patch: string,
  summary: MigrationSummary,
): Promise<void> {
  const applied: FileMigration[] = [];
  let tsconfigApplied = false;

  try {
    for (const migration of migrations) {
      await rename(migration.sourcePath, migration.targetPath);
      applied.push(migration);
      await writeFile(migration.targetPath, migration.after, "utf8");
    }

    if (tsconfig) {
      await writeFile(tsconfig.path, tsconfig.after, "utf8");
      tsconfigApplied = true;
    }

    const artifactDirectory = join(root, ARTIFACT_DIRECTORY);
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(join(root, PATCH_ARTIFACT), patch, "utf8");
    await writeFile(
      join(root, SUMMARY_ARTIFACT),
      `${JSON.stringify(summary, null, 2)}\n`,
      "utf8",
    );
  } catch (error) {
    await rollbackMigration(applied, tsconfig, tsconfigApplied);
    throw error;
  }
}

async function assertArtifactPathsAreSafe(root: string): Promise<void> {
  const artifactDirectory = join(root, ARTIFACT_DIRECTORY);
  const directoryStats = await lstatIfExists(artifactDirectory);

  if (
    directoryStats &&
    (directoryStats.isSymbolicLink() || !directoryStats.isDirectory())
  ) {
    throw new MigrationExecutionError(
      "UNSAFE_ARTIFACT_PATH",
      `${ARTIFACT_DIRECTORY} must be a regular directory inside the repository.`,
    );
  }

  if (!directoryStats) return;

  for (const artifactPath of [PATCH_ARTIFACT, SUMMARY_ARTIFACT]) {
    const stats = await lstatIfExists(join(root, artifactPath));

    if (stats && (stats.isSymbolicLink() || !stats.isFile())) {
      throw new MigrationExecutionError(
        "UNSAFE_ARTIFACT_PATH",
        `${artifactPath} must be a regular file inside the repository.`,
      );
    }
  }
}

async function rollbackMigration(
  applied: FileMigration[],
  tsconfig: TsconfigMigration | null,
  tsconfigApplied: boolean,
): Promise<void> {
  if (tsconfig && tsconfigApplied) {
    if (tsconfig.before === null) {
      await rm(tsconfig.path, { force: true });
    } else {
      await writeFile(tsconfig.path, tsconfig.before, "utf8");
    }
  }

  for (const migration of [...applied].reverse()) {
    await rm(migration.targetPath, { force: true });
    await mkdir(dirname(migration.sourcePath), { recursive: true });
    await writeFile(migration.sourcePath, migration.before, "utf8");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPrettierModule(value: unknown): value is PrettierModule {
  return (
    typeof value === "object" &&
    value !== null &&
    "format" in value &&
    typeof value.format === "function"
  );
}

function toPosixPath(path: string): string {
  return path.replaceAll("\\", "/");
}
