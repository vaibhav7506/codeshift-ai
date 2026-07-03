import type {
  MigrationPlan,
  MigrationSummary,
  RepositoryAnalysis,
  ValidationResult,
} from "@codeshift/shared";

export const AI_PROVIDER_NAMES = [
  "openai",
  "groq",
  "gemini",
  "anthropic",
] as const;

export type AIProviderName = (typeof AI_PROVIDER_NAMES)[number];

export const AI_PROVIDER_ENVIRONMENT_VARIABLES: Record<
  AIProviderName,
  string
> = {
  openai: "OPENAI_API_KEY",
  groq: "GROQ_API_KEY",
  gemini: "GEMINI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

export interface AIProviderConfig {
  apiKey: string;
  model?: string;
  fetchImplementation?: typeof fetch;
}

export interface GenerateMigrationPlanInput {
  analysis: RepositoryAnalysis;
  selectedScope: string;
  deterministicPlan?: MigrationPlan;
}

export interface AIMigrationPlan {
  overview: string;
  risks: string[];
  steps: string[];
}

export interface ExplainPatchInput {
  selectedScope: string;
  patch: string;
  migrationSummary: MigrationSummary;
}

export interface PatchExplanation {
  summary: string;
  scopeAssessment: string;
  changes: Array<{
    file: string;
    explanation: string;
  }>;
  risks: string[];
}

export interface SuggestTypeFixesInput {
  selectedScope: string;
  diagnostics: string;
  patch?: string;
}

export interface TypeFixSuggestions {
  suggestions: Array<{
    file: string;
    issue: string;
    suggestion: string;
    confidence: "LOW" | "MEDIUM" | "HIGH";
  }>;
}

export interface GeneratePRSummaryInput {
  selectedScope: string;
  explanation: PatchExplanation;
  validationResults?: ValidationResult[];
}

export interface PRSummary {
  title: string;
  summary: string;
  testing: string[];
  risks: string[];
}

export interface AIProvider {
  readonly name: AIProviderName;
  generateMigrationPlan(input: GenerateMigrationPlanInput): Promise<AIMigrationPlan>;
  explainPatch(input: ExplainPatchInput): Promise<PatchExplanation>;
  suggestTypeFixes(input: SuggestTypeFixesInput): Promise<TypeFixSuggestions>;
  generatePRSummary(input: GeneratePRSummaryInput): Promise<PRSummary>;
}

export class AIProviderError extends Error {
  constructor(
    readonly code:
      | "MISSING_API_KEY"
      | "PROVIDER_NOT_IMPLEMENTED"
      | "REQUEST_FAILED"
      | "INVALID_RESPONSE",
    message: string,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

export function assertAPIKey(
  provider: AIProviderName,
  apiKey: string,
): string {
  const normalized = apiKey.trim();

  if (!normalized) {
    throw new AIProviderError(
      "MISSING_API_KEY",
      `${providerLabel(provider)} requires an API key.`,
    );
  }

  return normalized;
}

export function isAIProviderName(value: string): value is AIProviderName {
  return AI_PROVIDER_NAMES.includes(value as AIProviderName);
}

export function providerLabel(provider: AIProviderName): string {
  const labels: Record<AIProviderName, string> = {
    openai: "OpenAI",
    groq: "Groq",
    gemini: "Gemini",
    anthropic: "Anthropic",
  };

  return labels[provider];
}

export function createUnavailableProvider(
  name: Exclude<AIProviderName, "openai">,
  config: AIProviderConfig,
): AIProvider {
  assertAPIKey(name, config.apiKey);

  const unavailable = async (): Promise<never> => {
    throw new AIProviderError(
      "PROVIDER_NOT_IMPLEMENTED",
      `${providerLabel(name)} is configured in the provider architecture but is not implemented yet.`,
    );
  };

  return {
    name,
    generateMigrationPlan: unavailable,
    explainPatch: unavailable,
    suggestTypeFixes: unavailable,
    generatePRSummary: unavailable,
  };
}
