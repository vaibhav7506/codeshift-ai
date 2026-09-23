"use client";

import { useEffect, useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import type { WorkspaceApprovalPolicy } from "@codeshift/platform/enterprise-runtime";
import { GovernanceOverview } from "@/components/platform/GovernanceOverview";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { governancePages } from "@/lib/enterprise-demo";

interface PolicyResponse {
  policy?: WorkspaceApprovalPolicy & {
    workspaceKind: "PERSONAL" | "ORGANIZATION";
  };
  message?: string;
  error?: { message?: string };
}

const personalDefaults: WorkspaceApprovalPolicy & {
  workspaceKind: "PERSONAL" | "ORGANIZATION";
} = {
  maximumRiskScore: 80,
  requiredApprovals: 1,
  highRiskApprovals: 1,
  authorCanApprove: true,
  requireDistinctApprovers: false,
  allowSourceCodeSharing: false,
  workspaceKind: "PERSONAL",
};

export function WorkspacePolicyEditor() {
  const [policy, setPolicy] = useState(personalDefaults);
  const [draft, setDraft] = useState(personalDefaults);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    void loadPolicy();
  }, []);

  async function loadPolicy() {
    try {
      const response = await fetch("/api/organization/policies", {
        cache: "no-store",
      });
      const body = await readResponse(response);
      if (!response.ok || !body.policy) {
        throw new Error(body.error?.message ?? "Workspace policies could not be loaded.");
      }
      setPolicy(body.policy);
      setDraft(body.policy);
    } catch (error) {
      setToast({
        tone: "error",
        message: messageFor(error, "Workspace policies could not be loaded."),
      });
    }
  }

  const metrics = [
    {
      label: "Max risk",
      value: String(policy.maximumRiskScore),
      detail: "Higher scores are blocked",
      tone: "warning" as const,
    },
    {
      label: "Required reviews",
      value: String(policy.highRiskApprovals),
      detail: "For high-risk campaigns",
    },
    {
      label: "Source sharing",
      value: policy.allowSourceCodeSharing ? "Allowed" : "Blocked",
      detail: policy.allowSourceCodeSharing
        ? "Permitted by workspace policy"
        : "Explicit consent required",
      tone: "success" as const,
    },
  ];
  const personal = policy.workspaceKind === "PERSONAL";

  return (
    <>
      <GovernanceOverview
        {...governancePages.policies}
        metrics={metrics}
        action={
          !editing ? (
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              Edit policies
            </Button>
          ) : null
        }
      />
      {editing ? (
        <Card className="mt-5 shadow-none">
          <CardContent>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Policy settings</h3>
              <p className="mt-0.5 text-xs text-text-muted">
                Changes are validated and enforced at the server boundary.
              </p>
            </div>
            {personal ? (
              <p className="mt-4 rounded-lg border border-primary/20 bg-primary/[0.04] p-3 text-xs leading-5 text-text-secondary">
                Personal workspaces always require one review, allow the campaign author to approve, and do not require distinct approvers.
              </p>
            ) : null}
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <NumberField
                label="Maximum allowed risk score"
                value={draft.maximumRiskScore}
                min={0}
                max={100}
                onChange={(value) => setDraft({ ...draft, maximumRiskScore: value })}
              />
              <NumberField
                label="Required reviews for low/medium risk"
                value={draft.requiredApprovals}
                min={1}
                max={personal ? 1 : 10}
                disabled={personal}
                onChange={(value) => setDraft({ ...draft, requiredApprovals: value })}
              />
              <NumberField
                label="Required reviews for high/critical risk"
                value={draft.highRiskApprovals}
                min={1}
                max={personal ? 1 : 10}
                disabled={personal}
                onChange={(value) => setDraft({ ...draft, highRiskApprovals: value })}
              />
              <label className="space-y-2 text-xs font-medium text-text-secondary">
                <span>Source-code sharing policy</span>
                <select
                  value={draft.allowSourceCodeSharing ? "allowed" : "blocked"}
                  onChange={(event) => setDraft({
                    ...draft,
                    allowSourceCodeSharing: event.target.value === "allowed",
                  })}
                  className="h-11 w-full rounded-[10px] border border-border bg-background px-3.5 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  <option value="blocked">Blocked</option>
                  <option value="allowed">Allowed</option>
                </select>
              </label>
              <BooleanField
                label="Allow campaign author approval"
                checked={draft.authorCanApprove}
                disabled={personal}
                onChange={(checked) => setDraft({ ...draft, authorCanApprove: checked })}
              />
              <BooleanField
                label="Require distinct approvers"
                checked={draft.requireDistinctApprovers}
                disabled={personal}
                onChange={(checked) => setDraft({ ...draft, requireDistinctApprovers: checked })}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setDraft(policy);
                  setEditing(false);
                }}
              >
                <X className="size-4" />
                Cancel
              </Button>
              <Button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    const response = await fetch("/api/organization/policies", {
                      method: "PUT",
                      headers: {
                        "content-type": "application/json",
                        "x-codeshift-csrf": "1",
                      },
                      body: JSON.stringify(policyPayload(draft)),
                    });
                    const body = await readResponse(response);
                    if (!response.ok || !body.policy) {
                      throw new Error(body.error?.message ?? "Workspace policies could not be saved.");
                    }
                    setPolicy(body.policy);
                    setDraft(body.policy);
                    setEditing(false);
                    setToast({
                      tone: "success",
                      message: body.message ?? "Workspace policies saved.",
                    });
                  } catch (error) {
                    setToast({
                      tone: "error",
                      message: messageFor(error, "Workspace policies could not be saved."),
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <Save className="size-4" />
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      {toast ? (
        <Toast
          {...toast}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-2 text-xs font-medium text-text-secondary">
      <span>{label}</span>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function BooleanField({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-[10px] border border-border bg-background px-3.5 text-xs font-medium text-text-secondary">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-primary"
      />
      <span>{label}</span>
    </label>
  );
}

function policyPayload(policy: WorkspaceApprovalPolicy): WorkspaceApprovalPolicy {
  return {
    maximumRiskScore: policy.maximumRiskScore,
    requiredApprovals: policy.requiredApprovals,
    highRiskApprovals: policy.highRiskApprovals,
    authorCanApprove: policy.authorCanApprove,
    requireDistinctApprovers: policy.requireDistinctApprovers,
    allowSourceCodeSharing: policy.allowSourceCodeSharing,
  };
}

async function readResponse(response: Response): Promise<PolicyResponse> {
  return await response.json() as PolicyResponse;
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
