import type { MigrationRecipe, MigrationStage } from "./types.js";

export const MIGRATION_STAGES: readonly MigrationStage[] = [
  "repo",
  "analysis",
  "plan",
  "patch",
  "validate",
  "review",
  "pr",
];

export const MIGRATION_RECIPES: readonly MigrationRecipe[] = [
  { id: "js-to-ts", label: "JavaScript → TypeScript", availability: "active" },
  { id: "express-to-hono", label: "Express → Hono", availability: "coming-soon" },
  { id: "classes-to-hooks", label: "React classes → hooks", availability: "coming-soon" },
  { id: "css-to-tailwind", label: "CSS → Tailwind", availability: "coming-soon" },
  { id: "callbacks-to-async", label: "Callbacks → async/await", availability: "coming-soon" },
];
