export interface RiskModelInput {
  affectedFiles: number;
  dependencyFanIn: number;
  complexity: number;
  testCoveragePercent: number;
  authentication: boolean;
  payments: boolean;
  database: boolean;
  runtimeChange: boolean;
  frameworkChange: boolean;
  unsupportedDependencies: number;
  dynamicBehaviour: boolean;
  reflection: boolean;
  nativeApis: boolean;
  windowsOnlyDependencies: boolean;
  missingTests: boolean;
  migrationConfidence: number;
  historicalFailures: number;
  aiConfidence?: number;
}

export interface ExplainableRisk {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: Array<{ name: string; score: number; explanation: string }>;
}

export function calculateMigrationRisk(input: RiskModelInput): ExplainableRisk {
  const factors: ExplainableRisk["factors"] = [];
  add(factors, "Affected files", Math.min(15, Math.ceil(input.affectedFiles / 5)), `${input.affectedFiles} files`);
  add(factors, "Dependency fan-in", Math.min(10, Math.ceil(input.dependencyFanIn / 3)), `${input.dependencyFanIn} dependants`);
  add(factors, "Complexity", Math.min(10, Math.ceil(input.complexity / 10)), `Complexity ${input.complexity}`);
  add(factors, "Test coverage", input.testCoveragePercent < 50 ? 12 : input.testCoveragePercent < 80 ? 5 : 0, `${input.testCoveragePercent}% coverage`);
  addFlag(factors, "Authentication", input.authentication, 12);
  addFlag(factors, "Payments", input.payments, 15);
  addFlag(factors, "Database", input.database, 15);
  addFlag(factors, "Runtime change", input.runtimeChange, 10);
  addFlag(factors, "Framework change", input.frameworkChange, 12);
  add(factors, "Unsupported dependencies", Math.min(12, input.unsupportedDependencies * 3), `${input.unsupportedDependencies} unsupported`);
  addFlag(factors, "Dynamic behaviour", input.dynamicBehaviour, 8);
  addFlag(factors, "Reflection", input.reflection, 8);
  addFlag(factors, "Native APIs", input.nativeApis, 8);
  addFlag(factors, "Windows-only dependencies", input.windowsOnlyDependencies, 8);
  addFlag(factors, "Missing tests", input.missingTests, 15);
  add(factors, "Migration confidence", input.migrationConfidence < 0.5 ? 10 : input.migrationConfidence < 0.8 ? 4 : 0, `Deterministic confidence ${Math.round(input.migrationConfidence * 100)}%`);
  add(factors, "Historical failures", Math.min(10, input.historicalFailures * 2), `${input.historicalFailures} related failures`);
  const score = Math.min(100, factors.reduce((total, factor) => total + factor.score, 0));
  return {
    score,
    level: score >= 85 ? "CRITICAL" : score >= 65 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW",
    factors: factors.filter((factor) => factor.score > 0),
  };
}

function add(
  factors: ExplainableRisk["factors"],
  name: string,
  score: number,
  explanation: string,
): void {
  factors.push({ name, score, explanation });
}

function addFlag(
  factors: ExplainableRisk["factors"],
  name: string,
  enabled: boolean,
  score: number,
): void {
  if (enabled) add(factors, name, score, `${name} is involved`);
}
