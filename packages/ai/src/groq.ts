import {
  createUnavailableProvider,
  type AIProvider,
  type AIProviderConfig,
} from "./provider.js";

export function createGroqProvider(config: AIProviderConfig): AIProvider {
  return createUnavailableProvider("groq", config);
}
