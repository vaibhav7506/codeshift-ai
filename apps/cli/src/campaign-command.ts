import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { promisify } from "node:util";
import { createDefaultRecipeRegistry } from "@codeshift/platform/runtime";
import { campaignCliCommand } from "@codeshift/shared";
import type { RecipeFile } from "@codeshift/platform/runtime";
import { analyzeLocalRepository } from "./local-repository.js";
import { runLocalValidation } from "./validation.js";
import { runGitHubPRFlow } from "./github-pr.js";
import { formatValidationReport } from "./output.js";

const execFileAsync = promisify(execFile);
const CAMPAIGN_FILE = join(".codeshift-ai", "campaign.json");
const REPORT_FILE = join(".codeshift-ai", "campaign-report.json");
const CHECKPOINT_ROOT = join(".codeshift-ai", "campaign-checkpoints");
const IGNORED = new Set([".git", ".codeshift-ai", ".next", "dist", "node_modules"]);

interface ConnectedCampaign {
  id: string;
  recipeId: string;
  recipeVersion: string;
  recipeConfiguration: Record<string, string | number | boolean | string[]>;
  approvedScope: { paths: string[]; protectedPaths: string[] };
  validationRequirements: string[];
  targetBranch: string;
  status: "APPROVED";
  controlPlaneUrl?: string;
}

export async function runCampaignCommand(
  args: string[],
  cwd = process.cwd(),
): Promise<number> {
  const [action, ...actionArgs] = args;
  if (!action || action === "help" || action === "--help") {
    process.stdout.write(campaignHelp());
    return 0;
  }
  if (!campaignCliCommand(action)) return 1;
  if (action === "connect") return connectCampaign(actionArgs, cwd);

  const campaignId = parseCampaignId(actionArgs);
  const campaign = await loadCampaign(cwd, campaignId);
  if (action === "preflight") return preflight(cwd, campaign);
  if (action === "execute") return executeCampaign(cwd, campaign);
  if (action === "validate") {
    const result = await runLocalValidation(cwd);
    process.stdout.write(formatValidationReport(result));
    await reportEvent(campaign, "VALIDATION_COMPLETED", {
      validationPassed: result.overallPassed,
      reportLocation: result.resultArtifactPath,
    });
    return result.overallPassed ? 0 : 1;
  }
  if (action === "report") {
    process.stdout.write(await readFile(resolve(cwd, REPORT_FILE), "utf8"));
    return 0;
  }
  if (action === "rollback") return rollbackCampaign(cwd, campaign);
  if (action === "create-pr") {
    await runGitHubPRFlow({ cwd });
    return 0;
  }
  throw new Error(`Unknown campaign command "${action}".`);
}

async function connectCampaign(args: string[], cwd: string): Promise<number> {
  const options = parseArgs({
    args,
    options: {
      campaign: { type: "string" },
      token: { type: "string" },
      api: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });
  if (options.values.help) {
    process.stdout.write(`${campaignCliCommand("connect").usage}\n`);
    return 0;
  }
  const campaignId = validateCampaignId(options.values.campaign);
  const token = options.values.token?.trim();
  if (!token) throw new Error('Provide the short-lived token with "--token".');
  const api = new URL(options.values.api ?? process.env.CODESHIFT_API_URL ?? "http://localhost:3000");
  const endpoint = new URL(
    `/api/campaigns/${encodeURIComponent(campaignId)}/execution-context`,
    api,
  );
  const response = await fetch(endpoint, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await response.json()) as {
    campaign?: ConnectedCampaign;
    error?: { message?: string };
  };
  if (!response.ok || !body.campaign) {
    throw new Error(body.error?.message ?? "The approved campaign could not be loaded.");
  }
  if (body.campaign.id !== campaignId || body.campaign.status !== "APPROVED") {
    throw new Error("The control plane returned an invalid campaign context.");
  }
  const path = resolve(cwd, CAMPAIGN_FILE);
  await mkdir(dirname(path), { recursive: true });
  const connected = {
    ...body.campaign,
    controlPlaneUrl: api.origin,
  };
  await writeFile(path, `${JSON.stringify(connected, null, 2)}\n`, "utf8");
  process.stdout.write(`Connected approved campaign ${campaignId}. The temporary token was not saved.\n`);
  return 0;
}

async function preflight(cwd: string, campaign: ConnectedCampaign): Promise<number> {
  createDefaultRecipeRegistry().get(campaign.recipeId, campaign.recipeVersion);
  const { stdout } = await execFileAsync("git", ["status", "--short"], { cwd });
  if (stdout.trim()) {
    throw new Error("Preflight requires a clean Git working tree.");
  }
  for (const scope of campaign.approvedScope.paths) normalizeScope(scope);
  process.stdout.write(
    `Preflight passed for ${campaign.recipeId}@${campaign.recipeVersion} in ${campaign.approvedScope.paths.join(", ")}.\n`,
  );
  return 0;
}

async function executeCampaign(cwd: string, campaign: ConnectedCampaign): Promise<number> {
  await preflight(cwd, campaign);
  await reportEvent(campaign, "EXECUTION_STARTED", { stage: "preflight-complete" });
  const analysis = await analyzeLocalRepository(cwd);
  const files = await readRepositoryFiles(cwd);
  const recipe = createDefaultRecipeRegistry().get(
    campaign.recipeId,
    campaign.recipeVersion,
  );
  const changedFiles = new Set<string>();
  const warnings: string[] = [];
  const checkpoint = resolve(cwd, CHECKPOINT_ROOT, campaign.id);
  await mkdir(checkpoint, { recursive: true });

  for (const requestedScope of campaign.approvedScope.paths) {
    const scope = normalizeScope(requestedScope);
    await checkpointFiles(cwd, checkpoint, files, scope);
    const plan = await recipe.plan({
      repositoryId: analysis.repoUrl,
      analysis,
      files,
      approvedScope: scope,
    });
    const result = await recipe.transform({
      repositoryId: analysis.repoUrl,
      analysis,
      files,
      approvedScope: scope,
      rootPath: cwd,
      plan,
    });
    warnings.push(...result.warnings);
    result.changedFiles.forEach((file) => changedFiles.add(file));
    for (const change of result.fileChanges ?? []) {
      const path = safeRepositoryPath(cwd, change.path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, change.updatedCode, "utf8");
      changedFiles.add(change.path);
    }
  }
  const report = {
    campaignId: campaign.id,
    recipeId: campaign.recipeId,
    recipeVersion: campaign.recipeVersion,
    changedFileCount: changedFiles.size,
    changedFiles: [...changedFiles].sort(),
    warnings,
    checkpoint: relative(cwd, checkpoint).replaceAll("\\", "/"),
    createdAt: new Date().toISOString(),
  };
  await writeFile(resolve(cwd, REPORT_FILE), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Executed ${campaign.recipeId}@${campaign.recipeVersion}. ${changedFiles.size} file(s) changed. Review ${REPORT_FILE}.\n`,
  );
  await reportEvent(campaign, "EXECUTION_COMPLETED", {
    changedFileCount: changedFiles.size,
    reportLocation: REPORT_FILE.replaceAll("\\", "/"),
    branchName: campaign.targetBranch,
  });
  return 0;
}

async function rollbackCampaign(cwd: string, campaign: ConnectedCampaign): Promise<number> {
  const checkpoint = resolve(cwd, CHECKPOINT_ROOT, campaign.id);
  const checkpointInfo = await stat(checkpoint).catch(() => null);
  if (!checkpointInfo?.isDirectory()) throw new Error("No campaign checkpoint is available.");
  await cp(checkpoint, cwd, { recursive: true, force: true });
  await reportEvent(campaign, "ROLLBACK_COMPLETED", {
    rollbackResult: "checkpoint-restored",
  });
  process.stdout.write(`Restored checkpoint for campaign ${campaign.id}.\n`);
  return 0;
}

async function reportEvent(
  campaign: ConnectedCampaign,
  type: string,
  payload: Record<string, string | number | boolean>,
): Promise<void> {
  const token = process.env.CODESHIFT_CAMPAIGN_TOKEN;
  if (!token || !campaign.controlPlaneUrl) return;
  const correlationId = randomUUID();
  const response = await fetch(
    new URL(
      `/api/campaigns/${encodeURIComponent(campaign.id)}/events`,
      campaign.controlPlaneUrl,
    ),
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": randomUUID(),
      },
      body: JSON.stringify({ type, correlationId, payload }),
    },
  );
  if (!response.ok) {
    process.stderr.write("Warning: the sanitized campaign event could not be reported.\n");
  }
}

async function loadCampaign(cwd: string, expectedId: string): Promise<ConnectedCampaign> {
  const body = JSON.parse(await readFile(resolve(cwd, CAMPAIGN_FILE), "utf8")) as Partial<ConnectedCampaign>;
  if (
    body.id !== expectedId ||
    body.status !== "APPROVED" ||
    typeof body.recipeId !== "string" ||
    typeof body.recipeVersion !== "string" ||
    !body.approvedScope ||
    !Array.isArray(body.approvedScope.paths)
  ) {
    throw new Error("The local approved campaign context is missing or invalid. Run campaign connect again.");
  }
  return body as ConnectedCampaign;
}

function parseCampaignId(args: string[]): string {
  const options = parseArgs({
    args,
    options: {
      campaign: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });
  if (options.values.help) throw new Error("Use the command-specific usage shown by codeshift-ai --help.");
  return validateCampaignId(options.values.campaign);
}

function validateCampaignId(value: string | undefined): string {
  if (!value || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(value)) {
    throw new Error('Provide a valid campaign ID with "--campaign".');
  }
  return value;
}

function normalizeScope(value: string): string {
  const scope = value.replaceAll("\\", "/").replace(/\/\*\*\/?$/, "").replace(/^\.\/|\/+$/g, "") || ".";
  if (scope === ".." || scope.startsWith("../") || scope.includes("/../")) {
    throw new Error("Campaign scope escapes the repository.");
  }
  return scope;
}

async function readRepositoryFiles(cwd: string): Promise<RecipeFile[]> {
  const files: RecipeFile[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || IGNORED.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        const info = await stat(path);
        if (info.size > 512_000) continue;
        const content = await readFile(path, "utf8").catch(() => undefined);
        if (content !== undefined) {
          files.push({
            path: relative(cwd, path).replaceAll("\\", "/"),
            content,
            size: info.size,
          });
        }
      }
      if (files.length > 5_000) throw new Error("Repository file limit exceeded.");
    }
  }
  await visit(cwd);
  return files;
}

async function checkpointFiles(
  cwd: string,
  checkpoint: string,
  files: RecipeFile[],
  scope: string,
): Promise<void> {
  const prefix = scope === "." ? "" : `${scope}/`;
  for (const file of files) {
    if (scope !== "." && file.path !== scope && !file.path.startsWith(prefix)) continue;
    const source = safeRepositoryPath(cwd, file.path);
    const destination = resolve(checkpoint, file.path);
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination, { force: false });
  }
}

function safeRepositoryPath(cwd: string, path: string): string {
  const root = resolve(cwd);
  const candidate = resolve(root, path);
  if (candidate !== root && !candidate.startsWith(`${root}\\`) && !candidate.startsWith(`${root}/`)) {
    throw new Error("Recipe output escapes the repository.");
  }
  return candidate;
}

function campaignHelp(): string {
  const campaign = campaignCliCommand("connect");
  return [
    "",
    "Campaign workflow",
    `  ${campaign.usage}`,
    ...["preflight", "execute", "validate", "report", "rollback", "create-pr"].map(
      (command) => `  ${campaignCliCommand(command).usage}`,
    ),
    "",
  ].join("\n");
}
