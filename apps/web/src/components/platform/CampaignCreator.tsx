"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { demoCampaign, modernizationRecipes } from "@/lib/platform-demo";

export function CampaignCreator() {
  const [createdName, setCreatedName] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-4">
        {["Repository", "Recipe", "Scope & risk", "Validation"].map((step, index) => (
          <div
            key={step}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary"
          >
            <span className="mr-2 font-mono text-[10px] text-primary">
              {index + 1}
            </span>
            {step}
          </div>
        ))}
      </div>
      <Card className="shadow-none">
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_240px_minmax(0,0.8fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const nextName = String(form.get("campaignName") ?? "").trim();
              if (nextName) setCreatedName(nextName);
            }}
          >
            <label className="space-y-2 text-xs font-medium text-text-secondary">
              Campaign name
              <Input
                name="campaignName"
                maxLength={100}
                placeholder="Utilities TypeScript migration"
                required
              />
            </label>
            <label className="space-y-2 text-xs font-medium text-text-secondary">
              Recipe
              <select
                name="recipe"
                className="h-10 w-full rounded-[10px] border border-border bg-background px-3 text-sm text-text-primary"
              >
                {modernizationRecipes.map(([recipe]) => (
                  <option key={recipe} value={recipe.toLowerCase().replaceAll(" ", "-")}>
                    {recipe}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-xs font-medium text-text-secondary">
              Approved scope
              <Input
                name="scope"
                defaultValue="src/utils"
                maxLength={300}
                required
              />
            </label>
            <Button className="self-end" type="submit">
              <Plus className="size-4" />
              Create draft
            </Button>
          </form>
          <p className="mt-3 text-xs text-text-muted">
            Draft creation does not execute code or modify a repository. Protected files and validation evidence are reviewed before approval.
          </p>
        </CardContent>
      </Card>

      {createdName ? (
        <Card className="border-primary/30 shadow-none">
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge tone="primary">Draft</Badge>
                <span className="font-mono text-[10px] text-text-muted">
                  LOCAL CONTROL PLANE
                </span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-text-primary">
                {createdName}
              </h3>
              <p className="mt-1 text-xs text-text-secondary">
                Scope, risk, and validation must be reviewed before approval.
              </p>
            </div>
            <Link
              href={`/campaigns/${demoCampaign.id}`}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Review campaign
              <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
