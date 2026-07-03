import { Laptop, Moon, Palette, Sun } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Card } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BYOKSettings } from "@/components/settings/BYOKSettings";

export default function SettingsPage() {
  return (
    <AppShell
      title="Settings"
      description="Configure your local CodeShift AI workspace."
    >
      <div className="max-w-3xl">
        <div className="mb-6">
          <h2 className="text-xl font-semibold tracking-tight text-text-primary">
            Workspace preferences
          </h2>
          <p className="mt-1.5 text-sm text-text-secondary">
            Appearance and BYOK credentials are stored in this browser.
          </p>
        </div>

        <Card className="overflow-hidden shadow-none">
          <div className="flex items-center gap-3 border-b border-border p-5">
            <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-muted text-primary">
              <Palette className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Appearance
              </h3>
              <p className="mt-0.5 text-xs text-text-muted">
                Cycle between system, light, and dark modes.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {[
                { icon: Laptop, label: "System" },
                { icon: Sun, label: "Light" },
                { icon: Moon, label: "Dark" },
              ].map((option) => {
                const Icon = option.icon;
                return (
                  <div
                    key={option.label}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-2 text-[10px] font-medium text-text-secondary"
                  >
                    <Icon className="size-3" />
                    {option.label}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Change theme</span>
              <ThemeToggle />
            </div>
          </div>
        </Card>

        <BYOKSettings />
      </div>
    </AppShell>
  );
}
