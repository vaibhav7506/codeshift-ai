export const demoRepository = {
  id: "codeshift-ai-demo-legacy-js",
  name: "codeshift-ai-demo-legacy-js",
  owner: "vaibhav7506",
  defaultBranch: "main",
  framework: "Express",
  language: "JavaScript",
  readiness: 72,
  risk: "MEDIUM",
  files: 34,
  lastAnalysis: "Baseline fixture",
};

export const demoCampaign = {
  id: "campaign-js-to-ts-utils",
  name: "Utilities TypeScript migration",
  repository: demoRepository.name,
  recipe: "JavaScript to TypeScript",
  version: "1.0.0",
  status: "READY FOR REVIEW",
  risk: "MEDIUM",
  riskScore: 42,
  affectedFiles: 6,
  scope: ["src/utils/**"],
  protectedFiles: [".github/**", "package-lock.json"],
  validations: ["npm test", "npm run build", "npm run typecheck"],
  checkpoint: "Pending execution approval",
  stages: [
    { name: "Repository analysis", status: "COMPLETED" },
    { name: "Migration planning", status: "COMPLETED" },
    { name: "Execution approval", status: "PENDING" },
    { name: "Scoped transformation", status: "BLOCKED" },
    { name: "Validation", status: "BLOCKED" },
    { name: "Final approval", status: "BLOCKED" },
  ],
};

export const demoReport = {
  id: "phase-1-baseline",
  title: "Repository intelligence baseline",
  repository: demoRepository.name,
  generatedAt: "2026-07-23",
  languageBreakdown: [
    { language: "JavaScript", value: 82 },
    { language: "JSON / configuration", value: 12 },
    { language: "Other", value: 6 },
  ],
  dependencies: ["express", "cors", "dotenv"],
  routes: ["GET /health", "GET /users", "POST /users"],
  environmentVariables: ["PORT", "DATABASE_URL"],
  blockers: [
    "No typecheck script is available before the migration.",
    "Authentication middleware requires behaviour parity evidence.",
  ],
  sequence: ["JavaScript to TypeScript"],
};
