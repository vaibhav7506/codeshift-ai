import type { ValidationResult } from "@codeshift/shared";
import type {
  DotNetRepositoryReport,
  DotNetRouteManifest,
} from "./dotnet-intelligence.js";

export interface DotNetValidationCommand {
  command: string;
  required: boolean;
  reason: string;
}

export interface DotNetRouteParityDifference {
  key: string;
  field: "missing" | "authorization" | "controller-action";
  before: unknown;
  after: unknown;
}

export function createDotNetValidationContract(
  report: DotNetRepositoryReport,
): DotNetValidationCommand[] {
  return [
    {
      command: "dotnet restore",
      required: true,
      reason: "Resolve configured target frameworks and NuGet dependencies.",
    },
    {
      command: "dotnet build --no-restore",
      required: true,
      reason: "Verify SDK project conversion and source compatibility.",
    },
    {
      command: "dotnet test --no-build",
      required: true,
      reason: "Run the existing .NET test inventory.",
    },
    {
      command: "dotnet list package --vulnerable --include-transitive",
      required: true,
      reason: "Report direct and transitive vulnerable packages.",
    },
    {
      command: "dotnet format --verify-no-changes",
      required: false,
      reason: "Check generated C# formatting when dotnet-format is available.",
    },
    {
      command: "docker build .",
      required: report.targetConfiguration?.containerTarget !== "none",
      reason: "Validate the configured container target.",
    },
  ];
}

export function compareDotNetRoutes(
  baseline: readonly DotNetRouteManifest[],
  migrated: readonly DotNetRouteManifest[],
): {
  passed: boolean;
  routeParity: { passed: number; total: number };
  differences: DotNetRouteParityDifference[];
} {
  const migratedByKey = new Map(
    migrated.map((route) => [routeKey(route), route]),
  );
  const differences: DotNetRouteParityDifference[] = [];
  let passed = 0;

  for (const before of baseline) {
    const key = routeKey(before);
    const after = migratedByKey.get(key);
    if (!after) {
      differences.push({
        key,
        field: "missing",
        before,
        after: undefined,
      });
      continue;
    }
    if (!sameStrings(before.authorization, after.authorization)) {
      differences.push({
        key,
        field: "authorization",
        before: before.authorization,
        after: after.authorization,
      });
      continue;
    }
    if (
      before.controller !== after.controller ||
      before.action !== after.action
    ) {
      differences.push({
        key,
        field: "controller-action",
        before: `${before.controller}.${before.action}`,
        after: `${after.controller}.${after.action}`,
      });
      continue;
    }
    passed += 1;
  }

  return {
    passed: differences.length === 0,
    routeParity: { passed, total: baseline.length },
    differences,
  };
}

export function summarizeDotNetValidation(
  contract: readonly DotNetValidationCommand[],
  results: readonly ValidationResult[],
): {
  passed: boolean;
  missingRequired: string[];
  failed: string[];
  skipped: string[];
} {
  const resultByCommand = new Map(results.map((result) => [result.command, result]));
  const missingRequired = contract
    .filter((entry) => entry.required && !resultByCommand.has(entry.command))
    .map((entry) => entry.command);
  const failed = results
    .filter((result) => result.status === "FAILED")
    .map((result) => result.command);
  const skipped = results
    .filter((result) => result.status === "SKIPPED")
    .map((result) => result.command);
  const requiredSkipped = contract
    .filter(
      (entry) =>
        entry.required && resultByCommand.get(entry.command)?.status === "SKIPPED",
    )
    .map((entry) => entry.command);

  return {
    passed:
      missingRequired.length === 0 &&
      failed.length === 0 &&
      requiredSkipped.length === 0,
    missingRequired,
    failed,
    skipped,
  };
}

function routeKey(route: DotNetRouteManifest): string {
  return `${route.method.toUpperCase()} ${normalizeRoute(route.template)}`;
}

function normalizeRoute(value: string): string {
  return `/${value}`.replaceAll("//", "/").replace(/\/+$/, "") || "/";
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return [...left].sort().join("\0") === [...right].sort().join("\0");
}
