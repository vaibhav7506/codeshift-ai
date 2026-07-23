"use client";

import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export function BYOKSettings() {
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("workspace-default");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveCredential() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/settings/ai-credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CodeShift-CSRF": "1",
        },
        body: JSON.stringify({
          provider,
          model,
          apiKey,
          sourceCodeConsent: false,
          retentionDays: 0,
        }),
      });
      const result = await response.json() as {
        credential?: { key: string };
        error?: { message: string };
      };
      if (!response.ok) throw new Error(result.error?.message ?? "Credential could not be saved.");
      setApiKey("");
      setMessage(`Credential saved as ${result.credential?.key ?? "••••••••"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Credential could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-5 overflow-hidden shadow-none">
      <div className="flex items-center justify-between gap-3 border-b border-border p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-muted text-primary">
            <KeyRound className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">AI credentials</h3>
            <p className="mt-0.5 text-xs text-text-muted">Encrypted server-side and scoped to this workspace.</p>
          </div>
        </div>
        <Badge tone="success">AES-256-GCM</Badge>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-medium text-text-secondary">
            Provider
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-text-primary"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-medium text-text-secondary">
            Model
            <Input value={model} maxLength={100} onChange={(event) => setModel(event.target.value)} />
          </label>
        </div>
        <label className="block space-y-1.5 text-xs font-medium text-text-secondary">
          API key
          <Input
            type="password"
            autoComplete="off"
            value={apiKey}
            maxLength={500}
            placeholder="Entered once; never returned by the API"
            onChange={(event) => setApiKey(event.target.value)}
          />
        </label>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 text-xs leading-5 text-text-secondary">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
            Source-code sharing is disabled and retention is set to zero by default.
          </div>
          <Button type="button" size="sm" disabled={saving || apiKey.length < 8} onClick={saveCredential}>
            {saving ? "Saving…" : "Encrypt and save"}
          </Button>
        </div>
        {message && <p role="status" className="text-xs text-text-secondary">{message}</p>}
      </div>
    </Card>
  );
}
