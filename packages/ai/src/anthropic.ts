import {
  createUnavailableProvider,
  type AIProvider,
  type AIProviderConfig,
} from "./provider.js";

export function createAnthropicProvider(config: AIProviderConfig): AIProvider {
  return createUnavailableProvider("anthropic", config);
}
