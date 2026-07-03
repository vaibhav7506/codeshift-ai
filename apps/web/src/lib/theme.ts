export const THEME_STORAGE_KEY = "codeshift-theme";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const themeOptions: readonly ThemePreference[] = [
  "system",
  "light",
  "dark",
];

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function resolveTheme(theme: ThemePreference): ResolvedTheme {
  if (theme !== "system") {
    return theme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;

  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = resolved;

  return resolved;
}

export const themeInitializationScript = `
  (() => {
    try {
      const stored = localStorage.getItem("${THEME_STORAGE_KEY}");
      const preference = stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
      const dark = preference === "dark" ||
        (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      const root = document.documentElement;
      root.classList.toggle("dark", dark);
      root.dataset.theme = preference;
      root.style.colorScheme = dark ? "dark" : "light";
    } catch (_) {
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.dataset.theme = "system";
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    }
  })();
`;
