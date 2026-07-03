"use client";

import { useEffect, useState } from "react";
import { Laptop, Moon, Sun } from "lucide-react";
import {
  applyTheme,
  isThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const nextTheme: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const labels: Record<ThemePreference, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

const icons = {
  system: Laptop,
  light: Sun,
  dark: Moon,
};

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<ThemePreference>("system");

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const preference = isThemePreference(stored) ? stored : "system";
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    setTheme(preference);
    applyTheme(preference);

    const handleSystemChange = () => {
      if ((document.documentElement.dataset.theme ?? "system") === "system") {
        applyTheme("system");
      }
    };

    media.addEventListener("change", handleSystemChange);
    return () => media.removeEventListener("change", handleSystemChange);
  }, []);

  const handleToggle = () => {
    const next = nextTheme[theme];
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
    setTheme(next);
  };

  const Icon = icons[theme];

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-[9px] border border-border bg-surface text-text-secondary transition hover:border-primary/40 hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
      aria-label={`${labels[theme]}. Switch to ${labels[nextTheme[theme]].toLowerCase()}.`}
      title={`${labels[theme]} · click to switch`}
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  );
}
