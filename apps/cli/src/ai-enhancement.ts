import {
  AI_PROVIDER_ENVIRONMENT_VARIABLES,
  createAIProvider,
  isAIProviderImplemented,
  isAIProviderName,
  providerLabel,
  type AIProviderName,
  type PatchExplanation,
  type PRSummary,
} from "@codeshift/ai/runtime";
import type { MigrationExecutionResult } from "@codeshift/migrator/migration-runtime";
import {
  lstat,
  mkdir,
  writeFile,
} from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const ARTIFACT_DIRECTORY = ".codeshift-ai";
const AI_ARTIFACT_FILE = "ai-enhancement.json";

export interface CLIAIConfiguration {
  provider: AIProviderName;
  apiKey: string;
  model?: string;
}

export interface AIEnhancementArtifact {
  provider: AIProviderName;
  selectedScope: string;
  patchExplanation: PatchExplanation;
  prSummary: PRSummary;
  createdAt: string;
}

export interface AIEnhancementResult {
  artifact: AIEnhancementArtifact;
  artifactPath: string;
}

export function resolveCLIAIConfiguration(
  providerValue: string | undefined,
  environment: NodeJS.ProcessEnv = process.env,
): CLIAIConfiguration {
  const provider = providerValue?.trim().toLowerCase() || "openai";

  if (!isAIProviderName(provider)) {
    throw new Error(
      'The supported AI providers are "openai", "groq", "gemini", and "anthropic".',
    );
  }

  const environmentVariable = AI_PROVIDER_ENVIRONMENT_VARIABLES[provider];
  const apiKey = environment[environmentVariable]?.trim();

  if (!apiKey) {
    throw new Error(
      `AI features require BYOK. Add ${environmentVariable} or run without --ai.`,
    );
  }

  if (!isAIProviderImplemented(provider)) {
    throw new Error(
      `${providerLabel(provider)} is not implemented yet. Use OpenAI or run without --ai.`,
    );
  }

  return {
    provider,
    apiKey,
    model:
      provider === "openai"
        ? environment.OPENAI_MODEL?.trim() || undefined
        : undefined,
  };
}

export async function createMigrationAIEnhancement(
  cwd: string,
  migration: MigrationExecutionResult,
  configuration: CLIAIConfiguration,
): Promise<AIEnhancementResult> {
  const provider = createAIProvider(configuration.provider, {
    apiKey: configuration.apiKey,
    model: configuration.model,
  });
  const patchExplanation = await provider.explainPatch({
    selectedScope: migration.summary.selectedScope,
    patch: migration.patch,
    migrationSummary: migration.summary,
  });
  const prSummary = await provider.generatePRSummary({
    selectedScope: migration.summary.selectedScope,
    explanation: patchExplanation,
  });
  const artifact: AIEnhancementArtifact = {
    provider: configuration.provider,
    selectedScope: migration.summary.selectedScope,
    patchExplanation,
    prSummary,
    createdAt: new Date().toISOString(),
  };
  const root = resolve(cwd);
  const artifactDirectory = join(root, ARTIFACT_DIRECTORY);
  const artifactPath = join(artifactDirectory, AI_ARTIFACT_FILE);

  await assertAIArtifactPathIsSafe(artifactDirectory, artifactPath);
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(
    artifactPath,
    `${JSON.stringify(artifact, null, 2)}\n`,
    "utf8",
  );

  return {
    artifact,
    artifactPath: toPosixPath(relative(root, artifactPath)),
  };
}

async function assertAIArtifactPathIsSafe(
  artifactDirectory: string,
  artifactPath: string,
): Promise<void> {
  const directoryStats = await lstatIfExists(artifactDirectory);

  if (
    directoryStats &&
    (directoryStats.isSymbolicLink() || !directoryStats.isDirectory())
  ) {
    throw new Error(
      `${ARTIFACT_DIRECTORY} must be a regular repository directory.`,
    );
  }

  const artifactStats = await lstatIfExists(artifactPath);

  if (
    artifactStats &&
    (artifactStats.isSymbolicLink() || !artifactStats.isFile())
  ) {
    throw new Error(
      `${ARTIFACT_DIRECTORY}/${AI_ARTIFACT_FILE} must be a regular file.`,
    );
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

function toPosixPath(path: string): string {
  return path.replaceAll("\\", "/");
}
