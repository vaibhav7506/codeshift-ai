import { execFile } from "node:child_process";
import {
  lstat,
  readFile,
} from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { createInterface, type Interface } from "node:readline/promises";
import { Writable } from "node:stream";
import type {
  MigrationSummary,
  ValidationResult,
} from "@codeshift/shared";

const ARTIFACT_DIRECTORY = ".codeshift-ai";
const MIGRATION_SUMMARY_FILE = "migration-summary.json";
const VALIDATION_RESULT_FILE = "validation-result.json";
const PATCH_FILE = "patch.diff";
const GITHUB_API_VERSION = "2026-03-10";

interface GitHubRepository {
  owner: string;
  repo: string;
}

interface PullRequestArtifacts {
  migration: MigrationSummary;
  validationResults: ValidationResult[] | null;
  patch: string | null;
}

interface RepositoryState {
  root: string;
  baseBranch: string;
  remoteName: string;
  remoteURL: string;
  githubRepository: GitHubRepository;
  changedFiles: string[];
  migrationPaths: string[];
}

export interface PRPrompter {
  confirm(message: string): Promise<boolean>;
  requestToken(message: string): Promise<string>;
  close?(): void;
}

export interface GitHubPRFlowOptions {
  cwd: string;
  environment?: NodeJS.ProcessEnv;
  fetchImplementation?: typeof fetch;
  now?: Date;
  output?: NodeJS.WritableStream;
  prompter?: PRPrompter;
}

export interface GitHubPRFlowResult {
  status:
    | "CANCELLED"
    | "BRANCH_CREATED"
    | "LOCAL_COMMIT_CREATED"
    | "BRANCH_PUSHED"
    | "PR_CREATED";
  branchName: string;
  pullRequestURL?: string;
}

export class GitHubPRFlowError extends Error {
  constructor(
    readonly code:
      | "INVALID_ARTIFACT"
      | "NOT_GIT_REPOSITORY"
      | "NO_REMOTE"
      | "UNSUPPORTED_REMOTE"
      | "UNSAFE_GIT_STATE"
      | "GIT_FAILED"
      | "GITHUB_REQUEST_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "GitHubPRFlowError";
  }
}

export async function runGitHubPRFlow({
  cwd,
  environment = process.env,
  fetchImplementation = fetch,
  now = new Date(),
  output = process.stdout,
  prompter,
}: GitHubPRFlowOptions): Promise<GitHubPRFlowResult> {
  const root = resolve(cwd);
  const artifacts = await readPullRequestArtifacts(root);
  const repository = await inspectRepository(root, artifacts);
  const branchName = createBranchName(now);
  const title = createMigrationTitle(artifacts.migration.selectedScope);
  const body = buildPullRequestBody(artifacts);
  const interactivePrompter =
    prompter ?? new InteractivePrompter(process.stdin, output);

  writePreview(output, artifacts, repository, branchName);

  try {
    const approveBranch = await interactivePrompter.confirm(
      `Create branch "${branchName}"?`,
    );

    if (!approveBranch) {
      output.write("\nCancelled. No branch, commit, push, or pull request was created.\n");
      return { status: "CANCELLED", branchName };
    }

    await runGit(repository.root, ["switch", "-c", branchName]);
    output.write(`\nCreated branch ${branchName}.\n`);

    const approveCommit = await interactivePrompter.confirm(
      `Stage only the migration files and commit as "${title}"?`,
    );

    if (!approveCommit) {
      output.write(
        "\nCommit skipped. The new local branch remains checked out; nothing was pushed.\n",
      );
      return { status: "BRANCH_CREATED", branchName };
    }

    await runGit(repository.root, [
      "add",
      "-A",
      "--",
      ...repository.migrationPaths,
    ]);
    await assertOnlyMigrationFilesAreStaged(
      repository.root,
      repository.migrationPaths,
    );
    await runGit(repository.root, ["commit", "-m", title]);
    output.write(`\nCreated commit: ${title}\n`);

    let token = environment.GITHUB_TOKEN?.trim() ?? "";

    if (!token) {
      token = (
        await interactivePrompter.requestToken(
          "GITHUB_TOKEN is not set. Enter a token now (input hidden), or press Enter to keep the local branch only: ",
        )
      ).trim();
    }

    if (!token) {
      output.write(
        `\nLocal branch and commit are ready. Set GITHUB_TOKEN, push with \`git push -u ${repository.remoteName} ${branchName}\`, then open a pull request on GitHub when ready.\n`,
      );
      return { status: "LOCAL_COMMIT_CREATED", branchName };
    }

    const approvePush = await interactivePrompter.confirm(
      `Push "${branchName}" to remote "${repository.remoteName}"?`,
    );

    if (!approvePush) {
      output.write("\nPush skipped. The branch and commit remain local.\n");
      return { status: "LOCAL_COMMIT_CREATED", branchName };
    }

    await runGit(
      repository.root,
      ["push", "-u", repository.remoteName, branchName],
      createPushEnvironment(environment, token, repository.remoteURL),
      token,
    );
    output.write(`\nPushed ${branchName} to ${repository.remoteName}.\n`);

    const approvePullRequest = await interactivePrompter.confirm(
      `Open a GitHub pull request from "${branchName}" into "${repository.baseBranch}"?`,
    );

    if (!approvePullRequest) {
      output.write("\nPull request creation skipped. The branch is available on GitHub.\n");
      return { status: "BRANCH_PUSHED", branchName };
    }

    const pullRequestURL = await createGitHubPullRequest({
      repository: repository.githubRepository,
      token,
      title,
      body,
      head: branchName,
      base: repository.baseBranch,
      fetchImplementation,
    });
    output.write(`\nPull request created: ${pullRequestURL}\n`);

    return {
      status: "PR_CREATED",
      branchName,
      pullRequestURL,
    };
  } finally {
    interactivePrompter.close?.();
  }
}

export function createBranchName(date: Date): string {
  const timestamp = date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 15);
  return `codeshift-ai/js-to-ts-${timestamp}`;
}

export function buildPullRequestBody({
  migration,
  validationResults,
}: Pick<
  PullRequestArtifacts,
  "migration" | "validationResults"
>): string {
  const files = migration.changedFiles.length
    ? migration.changedFiles.map((file) => `- ${markdownCode(file)}`)
    : ["- No changed files were recorded in the migration summary."];
  const validation = validationResults?.length
    ? validationResults.map(
        (result) =>
          `- ${validationLabel(result.command)}: ${result.status}`,
      )
    : ["- Validation results were not available."];
  const warnings = migration.warnings.length
    ? migration.warnings.map(
        (warning) => `- ${sanitizeMarkdownLine(warning)}`,
      )
    : ["- No migration warnings were reported."];

  return [
    "## Summary",
    `CodeShift AI migrated ${markdownCode(migration.selectedScope)} from JavaScript to TypeScript using a scoped, reviewable migration flow.`,
    "",
    "## Files Changed",
    ...files,
    "",
    "## Changes",
    "- Renamed selected `.js` files to `.ts` and JSX files to `.tsx` where safe",
    "- Added or minimally updated TypeScript configuration",
    "- Applied safe CommonJS/ESM conversions where possible",
    "",
    "## Validation",
    ...validation,
    "",
    "## Warnings / Risk Notes",
    ...warnings,
    "",
    "## Review Notes",
    "Please review generated types and edge-case runtime behavior before merging.",
    "",
    "_Generated by CodeShift AI._",
  ].join("\n");
}

export async function createGitHubPullRequest({
  repository,
  token,
  title,
  body,
  head,
  base,
  fetchImplementation = fetch,
}: {
  repository: GitHubRepository;
  token: string;
  title: string;
  body: string;
  head: string;
  base: string;
  fetchImplementation?: typeof fetch;
}): Promise<string> {
  let response: Response;

  try {
    response = await fetchImplementation(
      `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/pulls`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "CodeShift-AI",
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
        },
        body: JSON.stringify({
          title,
          body,
          head,
          base,
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );
  } catch (error) {
    throw new GitHubPRFlowError(
      "GITHUB_REQUEST_FAILED",
      `GitHub pull request request could not be completed: ${safeErrorMessage(error, token)}`,
    );
  }

  const responseBody = await readGitHubResponse(response);

  if (response.status !== 201) {
    const message =
      isRecord(responseBody) && typeof responseBody.message === "string"
        ? sanitizeText(responseBody.message, token)
        : `GitHub returned status ${response.status}.`;
    throw new GitHubPRFlowError(
      "GITHUB_REQUEST_FAILED",
      `GitHub pull request creation failed: ${message}`,
    );
  }

  if (
    !isRecord(responseBody) ||
    typeof responseBody.html_url !== "string"
  ) {
    throw new GitHubPRFlowError(
      "GITHUB_REQUEST_FAILED",
      "GitHub created the pull request but returned no pull request URL.",
    );
  }

  return responseBody.html_url;
}

export function parseGitHubRemote(remoteURL: string): GitHubRepository | null {
  const trimmed = remoteURL.trim();
  const scpMatch = /^git@github\.com:([^/]+)\/([^/]+)$/i.exec(trimmed);

  if (scpMatch?.[1] && scpMatch[2]) {
    return {
      owner: scpMatch[1],
      repo: removeGitSuffix(scpMatch[2]),
    };
  }

  try {
    const url = new URL(trimmed);
    if (
      url.hostname.toLowerCase() !== "github.com" ||
      (url.protocol !== "https:" && url.protocol !== "ssh:") ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol === "https:" && url.username) ||
      (url.protocol === "ssh:" && url.username !== "git")
    ) {
      return null;
    }

    const [owner, repo, ...extra] = url.pathname
      .replace(/^\/|\/$/g, "")
      .split("/");
    if (!owner || !repo || extra.length > 0) return null;

    return {
      owner,
      repo: removeGitSuffix(repo),
    };
  } catch {
    return null;
  }
}

async function inspectRepository(
  root: string,
  artifacts: PullRequestArtifacts,
): Promise<RepositoryState> {
  let repositoryRoot: string;

  try {
    repositoryRoot = (
      await runGit(root, ["rev-parse", "--show-toplevel"])
    ).stdout.trim();
  } catch {
    throw new GitHubPRFlowError(
      "NOT_GIT_REPOSITORY",
      "The current directory is not a Git repository.",
    );
  }

  if (!samePath(resolve(repositoryRoot), root)) {
    throw new GitHubPRFlowError(
      "NOT_GIT_REPOSITORY",
      "Run `codeshift-ai pr` from the repository root.",
    );
  }

  const baseBranch = (
    await runGit(root, ["branch", "--show-current"])
  ).stdout.trim();

  if (!baseBranch) {
    throw new GitHubPRFlowError(
      "UNSAFE_GIT_STATE",
      "Cannot create a pull request from a detached HEAD.",
    );
  }

  const stagedFiles = splitNullList(
    (await runGit(root, ["diff", "--cached", "--name-only", "-z"])).stdout,
  );

  if (stagedFiles.length > 0) {
    throw new GitHubPRFlowError(
      "UNSAFE_GIT_STATE",
      "Existing staged changes were found. Commit or unstage them before running `codeshift-ai pr`.",
    );
  }

  const remoteNames = (
    await runGit(root, ["remote"])
  ).stdout
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (remoteNames.length === 0) {
    throw new GitHubPRFlowError(
      "NO_REMOTE",
      "No Git remote exists. Add a GitHub remote before running `codeshift-ai pr`.",
    );
  }

  const remoteName = remoteNames.includes("origin")
    ? "origin"
    : (remoteNames[0] as string);
  const remoteURL = (
    await runGit(root, ["remote", "get-url", remoteName])
  ).stdout.trim();
  const githubRepository = parseGitHubRemote(remoteURL);

  if (!githubRepository) {
    throw new GitHubPRFlowError(
      "UNSUPPORTED_REMOTE",
      "The configured remote is not a supported github.com repository.",
    );
  }

  const changedFiles = uniqueSorted([
    ...splitNullList(
      (await runGit(root, ["diff", "--name-only", "-z"])).stdout,
    ),
    ...splitNullList(
      (
        await runGit(root, [
          "ls-files",
          "--others",
          "--exclude-standard",
          "-z",
        ])
      ).stdout,
    ),
  ]);

  if (changedFiles.length === 0) {
    throw new GitHubPRFlowError(
      "UNSAFE_GIT_STATE",
      "No uncommitted migration changes were found.",
    );
  }

  const expectedPaths = collectMigrationPaths(artifacts);
  const expectedSet = new Set(expectedPaths.map(normalizeComparablePath));
  const migrationPaths = changedFiles.filter((file) =>
    expectedSet.has(normalizeComparablePath(file)),
  );

  if (migrationPaths.length === 0) {
    throw new GitHubPRFlowError(
      "UNSAFE_GIT_STATE",
      "Git changes do not match the recorded migration artifacts.",
    );
  }

  return {
    root,
    baseBranch,
    remoteName,
    remoteURL,
    githubRepository,
    changedFiles,
    migrationPaths,
  };
}

async function readPullRequestArtifacts(
  root: string,
): Promise<PullRequestArtifacts> {
  const artifactDirectory = join(root, ARTIFACT_DIRECTORY);
  const directoryStats = await lstatIfExists(artifactDirectory);

  if (
    !directoryStats ||
    directoryStats.isSymbolicLink() ||
    !directoryStats.isDirectory()
  ) {
    throw new GitHubPRFlowError(
      "INVALID_ARTIFACT",
      `A regular ${ARTIFACT_DIRECTORY} directory is required.`,
    );
  }

  const migrationValue = await readRequiredJSON(
    join(artifactDirectory, MIGRATION_SUMMARY_FILE),
    MIGRATION_SUMMARY_FILE,
  );

  if (!isMigrationSummary(migrationValue)) {
    throw new GitHubPRFlowError(
      "INVALID_ARTIFACT",
      `${MIGRATION_SUMMARY_FILE} is not valid.`,
    );
  }

  const validationValue = await readOptionalJSON(
    join(artifactDirectory, VALIDATION_RESULT_FILE),
    VALIDATION_RESULT_FILE,
  );

  if (
    validationValue !== null &&
    !isValidationResults(validationValue)
  ) {
    throw new GitHubPRFlowError(
      "INVALID_ARTIFACT",
      `${VALIDATION_RESULT_FILE} is not valid.`,
    );
  }

  const patch = await readOptionalText(
    join(artifactDirectory, PATCH_FILE),
    PATCH_FILE,
  );

  return {
    migration: migrationValue,
    validationResults: validationValue,
    patch,
  };
}

function collectMigrationPaths(
  artifacts: PullRequestArtifacts,
): string[] {
  const paths = new Set<string>();

  for (const file of artifacts.migration.changedFiles) {
    paths.add(normalizeSafeRepositoryPath(file));

    if (/\.tsx$/i.test(file)) {
      paths.add(normalizeSafeRepositoryPath(file.replace(/\.tsx$/i, ".jsx")));
    } else if (/\.ts$/i.test(file)) {
      paths.add(normalizeSafeRepositoryPath(file.replace(/\.ts$/i, ".js")));
    }
  }

  if (artifacts.patch) {
    for (const match of artifacts.patch.matchAll(
      /^(?:rename from|rename to) (.+)$/gm,
    )) {
      if (match[1]) paths.add(normalizeSafeRepositoryPath(match[1]));
    }
  }

  return [...paths];
}

async function assertOnlyMigrationFilesAreStaged(
  root: string,
  migrationPaths: string[],
): Promise<void> {
  const stagedFiles = splitNullList(
    (await runGit(root, ["diff", "--cached", "--name-only", "-z"])).stdout,
  );
  const allowed = new Set(migrationPaths.map(normalizeComparablePath));

  if (
    stagedFiles.length === 0 ||
    stagedFiles.some(
      (file) => !allowed.has(normalizeComparablePath(file)),
    )
  ) {
    throw new GitHubPRFlowError(
      "UNSAFE_GIT_STATE",
      "Staged files did not match the recorded migration paths. No commit was created.",
    );
  }
}

function writePreview(
  output: NodeJS.WritableStream,
  artifacts: PullRequestArtifacts,
  repository: RepositoryState,
  branchName: string,
): void {
  const validation = artifacts.validationResults?.length
    ? artifacts.validationResults
        .map(
          (result) =>
            `  ${result.status.padEnd(8)} ${validationLabel(result.command)}`,
        )
        .join("\n")
    : "  NOT RUN  No validation artifact found";
  const warnings = artifacts.migration.warnings.length
    ? artifacts.migration.warnings
        .map((warning) => `  - ${sanitizeMarkdownLine(warning)}`)
        .join("\n")
    : "  None";

  output.write(
    [
      "",
      "CodeShift AI",
      "GitHub Pull Request Review",
      "----------------------------------------------------------",
      `  Migration target      ${artifacts.migration.target}`,
      `  Selected scope        ${artifacts.migration.selectedScope}`,
      `  Base branch           ${repository.baseBranch}`,
      `  New branch            ${branchName}`,
      `  Patch artifact        ${artifacts.patch ? "Available" : "Not available"}`,
      "",
      "Changed files:",
      ...repository.changedFiles.map((file) => `  - ${file}`),
      "",
      "Validation:",
      validation,
      "",
      "Warnings:",
      warnings,
      "",
      "Every Git mutation requires a separate confirmation.",
      "",
    ].join("\n"),
  );
}

function createMigrationTitle(scope: string): string {
  return `Migrate ${scope} from JavaScript to TypeScript`;
}

function createPushEnvironment(
  source: NodeJS.ProcessEnv,
  token: string,
  remoteURL: string,
): NodeJS.ProcessEnv {
  const environment = { ...source };

  for (const key of Object.keys(environment)) {
    const normalizedKey = key.toUpperCase();
    if (
      normalizedKey === "GIT_TRACE" ||
      normalizedKey === "GIT_TRACE_CURL" ||
      normalizedKey === "GIT_CURL_VERBOSE" ||
      /^GIT_CONFIG_(?:COUNT|KEY_\d+|VALUE_\d+)$/.test(normalizedKey)
    ) {
      delete environment[key];
    }
  }

  environment.GIT_TERMINAL_PROMPT = "0";

  if (/^https:\/\/github\.com\//i.test(remoteURL)) {
    environment.GIT_CONFIG_COUNT = "1";
    environment.GIT_CONFIG_KEY_0 =
      "http.https://github.com/.extraheader";
    environment.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${Buffer.from(
      `x-access-token:${token}`,
    ).toString("base64")}`;
  }

  return environment;
}

function runGit(
  cwd: string,
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
  secret = "",
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolveCommand, rejectCommand) => {
    execFile(
      "git",
      args,
      {
        cwd,
        env: environment,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          const detail = sanitizeText(
            stderr.trim() || "Git operation failed.",
            secret,
          );
          rejectCommand(
            new GitHubPRFlowError("GIT_FAILED", detail),
          );
          return;
        }

        resolveCommand({ stdout, stderr });
      },
    );
  });
}

class MutedOutput extends Writable {
  muted = false;

  constructor(private readonly destination: NodeJS.WritableStream) {
    super();
  }

  override _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    if (!this.muted) {
      if (typeof chunk === "string") {
        this.destination.write(chunk, encoding);
      } else {
        this.destination.write(chunk);
      }
    }
    callback();
  }
}

class InteractivePrompter implements PRPrompter {
  private readonly mutedOutput: MutedOutput;
  private readonly interface: Interface;

  constructor(
    input: NodeJS.ReadableStream,
    private readonly output: NodeJS.WritableStream,
  ) {
    this.mutedOutput = new MutedOutput(output);
    this.interface = createInterface({
      input,
      output: this.mutedOutput,
      terminal: Boolean(
        "isTTY" in input &&
          input.isTTY &&
          "isTTY" in output &&
          output.isTTY,
      ),
    });
  }

  async confirm(message: string): Promise<boolean> {
    const answer = await this.interface.question(`${message} [y/N] `);
    return /^(?:y|yes)$/i.test(answer.trim());
  }

  async requestToken(message: string): Promise<string> {
    this.output.write(message);
    this.mutedOutput.muted = true;

    try {
      return await this.interface.question("");
    } finally {
      this.mutedOutput.muted = false;
      this.output.write("\n");
    }
  }

  close(): void {
    this.interface.close();
  }
}

async function readRequiredJSON(
  path: string,
  label: string,
): Promise<unknown> {
  const text = await readRequiredText(path, label);

  try {
    return JSON.parse(stripByteOrderMark(text)) as unknown;
  } catch {
    throw new GitHubPRFlowError(
      "INVALID_ARTIFACT",
      `${label} is not valid JSON.`,
    );
  }
}

async function readOptionalJSON(
  path: string,
  label: string,
): Promise<unknown | null> {
  const text = await readOptionalText(path, label);
  if (text === null) return null;

  try {
    return JSON.parse(stripByteOrderMark(text)) as unknown;
  } catch {
    throw new GitHubPRFlowError(
      "INVALID_ARTIFACT",
      `${label} is not valid JSON.`,
    );
  }
}

async function readRequiredText(
  path: string,
  label: string,
): Promise<string> {
  const stats = await lstatIfExists(path);

  if (!stats) {
    throw new GitHubPRFlowError(
      "INVALID_ARTIFACT",
      `${label} was not found. Run the migration first.`,
    );
  }

  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new GitHubPRFlowError(
      "INVALID_ARTIFACT",
      `${label} must be a regular file.`,
    );
  }

  return readFile(path, "utf8");
}

async function readOptionalText(
  path: string,
  label: string,
): Promise<string | null> {
  const stats = await lstatIfExists(path);
  if (!stats) return null;

  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new GitHubPRFlowError(
      "INVALID_ARTIFACT",
      `${label} must be a regular file.`,
    );
  }

  return readFile(path, "utf8");
}

async function readGitHubResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
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

function isMigrationSummary(value: unknown): value is MigrationSummary {
  if (!isRecord(value)) return false;

  try {
    normalizeSafeRepositoryPath(
      typeof value.selectedScope === "string" ? value.selectedScope : "",
    );
    if (!Array.isArray(value.changedFiles)) return false;
    value.changedFiles.forEach((file) =>
      normalizeSafeRepositoryPath(typeof file === "string" ? file : ""),
    );
  } catch {
    return false;
  }

  return (
    value.target === "JS_TO_TS" &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === "string") &&
    typeof value.tsconfigChanged === "boolean" &&
    typeof value.createdAt === "string"
  );
}

function isValidationResults(value: unknown): value is ValidationResult[] {
  return (
    Array.isArray(value) &&
    value.every(
      (result) =>
        isRecord(result) &&
        typeof result.command === "string" &&
        (result.status === "PASSED" ||
          result.status === "FAILED" ||
          result.status === "SKIPPED") &&
        typeof result.logs === "string" &&
        (result.durationMs === undefined ||
          typeof result.durationMs === "number"),
    )
  );
}

function normalizeSafeRepositoryPath(value: string): string {
  const normalized = value
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
  const segments = normalized.split("/");

  if (
    !normalized ||
    isAbsolute(value) ||
    /^[A-Za-z]:/.test(normalized) ||
    /[\0\r\n]/.test(normalized) ||
    segments.some((segment) => segment === ".." || segment === ".") ||
    segments[0]?.toLowerCase() === ".git"
  ) {
    throw new GitHubPRFlowError(
      "INVALID_ARTIFACT",
      "Migration artifacts contain an unsafe repository path.",
    );
  }

  return normalized;
}

function splitNullList(value: string): string[] {
  return value
    .split("\0")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeComparablePath(value: string): string {
  const normalized = value.replaceAll("\\", "/");
  return process.platform === "win32"
    ? normalized.toLowerCase()
    : normalized;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right),
  );
}

function samePath(left: string, right: string): boolean {
  return process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function validationLabel(command: string): string {
  const parts = command.trim().split(/\s+/);
  return sanitizeMarkdownLine(parts.at(-1) || command);
}

function markdownCode(value: string): string {
  return `\`${sanitizeMarkdownLine(value).replaceAll("`", "'")}\``;
}

function sanitizeMarkdownLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function safeErrorMessage(error: unknown, secret: string): string {
  const message =
    error instanceof Error ? error.message : "Unknown network error.";
  return sanitizeText(message, secret);
}

function sanitizeText(value: string, secret: string): string {
  return secret ? value.replaceAll(secret, "[REDACTED]") : value;
}

function removeGitSuffix(value: string): string {
  return value.replace(/\.git$/i, "");
}

function stripByteOrderMark(value: string): string {
  return value.replace(/^\uFEFF/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
