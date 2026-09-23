import type { MigrationStage } from "./types.js";

export const MIGRATION_STAGES: readonly MigrationStage[] = [
  "repo",
  "analysis",
  "plan",
  "patch",
  "validate",
  "review",
  "pr",
];
