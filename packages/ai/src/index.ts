import { createAnthropicProvider } from "./anthropic.js";
import { createGeminiProvider } from "./gemini.js";
import { createGroqProvider } from "./groq.js";
import { createOpenAIProvider } from "./openai.js";
import type {
  AIProvider,
  AIProviderConfig,
  AIProviderName,
} from "./provider.js";

export * from "./provider.js";
export { createOpenAIProvider, OpenAIProvider } from "./openai.js";
export { createGroqProvider } from "./groq.js";
export { createGeminiProvider } from "./gemini.js";
export { createAnthropicProvider } from "./anthropic.js";

export function createAIProvider(
  provider: AIProviderName,
  config: AIProviderConfig,
): AIProvider {
  if (provider === "openai") return createOpenAIProvider(config);
  if (provider === "groq") return createGroqProvider(config);
  if (provider === "gemini") return createGeminiProvider(config);
  return createAnthropicProvider(config);
}

export function isAIProviderImplemented(provider: AIProviderName): boolean {
  return provider === "openai";
}
