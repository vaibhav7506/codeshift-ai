"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function CampaignApprovalButton({ campaignId }: { campaignId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div>
      <Button
        size="sm"
        disabled={pending}
        onClick={async () => {
          if (pending) return;
          setPending(true);
          setError(null);
          try {
            const response = await fetch(
              `/api/campaigns/${encodeURIComponent(campaignId)}/approve`,
              { method: "POST", headers: { "x-codeshift-csrf": "1" } },
            );
            const body = (await response.json()) as {
              readyForExecution?: boolean;
              redirectTo?: string;
              message?: string;
              error?: { message?: string };
            };
            if (!response.ok || !body.readyForExecution || !body.redirectTo) {
              throw new Error(
                body.message ?? body.error?.message ?? "Approval could not be saved.",
              );
            }
            router.push(`${body.redirectTo}?approved=1`);
          } catch (caughtError) {
            setError(
              caughtError instanceof Error
                ? caughtError.message
                : "Approval could not be saved.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <LockKeyhole className="size-4" />
        {pending ? "Saving approval…" : "Approve plan"}
      </Button>
      {error ? <p role="alert" className="mt-1 max-w-64 text-[10px] text-danger">{error}</p> : null}
    </div>
  );
}
