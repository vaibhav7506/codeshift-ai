import {
  createUnavailableProvider,
  type AIProvider,
  type AIProviderConfig,
} from "./provider.js";

export function createGeminiProvider(config: AIProviderConfig): AIProvider {
  return createUnavailableProvider("gemini", config);
}
