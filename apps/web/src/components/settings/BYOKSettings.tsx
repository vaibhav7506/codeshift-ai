"use client";

import { useEffect, useState } from "react";
import { KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type Provider = "openai" | "groq" | "gemini" | "anthropic";

const PROVIDERS: Array<{
  value: Provider;
  label: string;
  status: "Available" | "Adapter stub";
}> = [
  { value: "openai", label: "OpenAI", status: "Available" },
  { value: "groq", label: "Groq", status: "Adapter stub" },
  { value: "gemini", label: "Gemini", status: "Adapter stub" },
  { value: "anthropic", label: "Anthropic", status: "Adapter stub" },
];

const SELECTED_PROVIDER_KEY = "codeshift-ai:byok:provider";
const providerStorageKey = (provider: Provider) =>
  `codeshift-ai:byok:key:${provider}`;

export function BYOKSettings() {
  const [provider, setProvider] = useState<Provider>("openai");
  const [apiKey, setAPIKey] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedProvider = readLocalValue(SELECTED_PROVIDER_KEY);
    const initialProvider = isProvider(storedProvider)
      ? storedProvider
      : "openai";

    setProvider(initialProvider);
    setAPIKey(readLocalValue(providerStorageKey(initialProvider)) ?? "");
  }, []);

  const providerDetails = PROVIDERS.find(
    (option) => option.value === provider,
  );

  function handleProviderChange(nextProvider: Provider) {
    setProvider(nextProvider);
    setAPIKey(readLocalValue(providerStorageKey(nextProvider)) ?? "");
    writeLocalValue(SELECTED_PROVIDER_KEY, nextProvider);
    setMessage("");
  }

  function saveKey() {
    const normalizedKey = apiKey.trim();

    if (!normalizedKey) {
      setMessage("Enter a key before saving, or clear the saved key.");
      return;
    }

    const saved =
      writeLocalValue(providerStorageKey(provider), normalizedKey) &&
      writeLocalValue(SELECTED_PROVIDER_KEY, provider);

    if (!saved) {
      setMessage("Browser storage is unavailable. The key was not saved.");
      return;
    }

    setAPIKey(normalizedKey);
    setMessage(`${providerDetails?.label ?? provider} key saved locally.`);
  }

  function clearKey() {
    removeLocalValue(providerStorageKey(provider));
    setAPIKey("");
    setMessage(`${providerDetails?.label ?? provider} key cleared.`);
  }

  return (
    <Card className="mt-4 overflow-hidden shadow-none">
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted text-primary">
            <KeyRound className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              AI provider
            </h3>
            <p className="mt-1 max-w-xl text-xs leading-5 text-text-muted">
              Bring your own API key. Your provider bills your usage directly;
              CodeShift AI does not include or pay for model usage.
            </p>
          </div>
        </div>
        <Badge tone={provider === "openai" ? "success" : "neutral"}>
          {providerDetails?.status}
        </Badge>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <label className="space-y-2">
            <span className="text-xs font-semibold text-text-secondary">
              Provider
            </span>
            <select
              value={provider}
              onChange={(event) =>
                handleProviderChange(event.target.value as Provider)
              }
              className="h-11 w-full rounded-[10px] border border-border bg-background px-3.5 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              {PROVIDERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold text-text-secondary">
              API key
            </span>
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => {
                setAPIKey(event.target.value);
                setMessage("");
              }}
              placeholder={`Enter your ${providerDetails?.label ?? provider} API key`}
              autoComplete="off"
              spellCheck={false}
              aria-describedby="byok-storage-warning"
            />
          </label>
        </div>

        {provider !== "openai" ? (
          <p className="rounded-[10px] border border-border bg-surface-muted px-3.5 py-3 text-xs leading-5 text-text-secondary">
            The {providerDetails?.label} adapter is represented in the provider
            architecture. CLI AI requests are currently implemented for OpenAI.
          </p>
        ) : null}

        <div
          id="byok-storage-warning"
          className="flex items-start gap-2.5 rounded-[10px] border border-warning/25 bg-warning/10 px-3.5 py-3 text-xs leading-5 text-text-secondary"
        >
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            For MVP, your key is stored locally in your browser and is not
            saved to our database.
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p
            className="min-h-5 text-xs text-text-muted"
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearKey}>
              <Trash2 className="size-3.5" />
              Clear
            </Button>
            <Button size="sm" onClick={saveKey}>
              Save locally
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function isProvider(value: string | null): value is Provider {
  return PROVIDERS.some((provider) => provider.value === value);
}

function readLocalValue(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalValue(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeLocalValue(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // The in-memory field is still cleared when browser storage is unavailable.
  }
}
