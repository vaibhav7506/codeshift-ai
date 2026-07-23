import {
  createDeterministicRecipe,
  type FileTransformResult,
} from "./deterministic-recipe.js";
import { modernizationMetadata } from "./modernization-metadata.js";

export const ESLINT_FLAT_METADATA = modernizationMetadata({
  id: "eslint-flat-config",
  name: "ESLint legacy configuration to flat configuration",
  description: "Generates an ESLint flat configuration beside a supported legacy JSON configuration.",
  sourceTechnology: "ESLint eslintrc",
  targetTechnology: "ESLint flat config",
  filesItMayModify: ["eslint.config.mjs"],
  knownLimitations: ["JavaScript-based legacy configs with executable logic remain unchanged."],
  riskFactors: ["Plugin compatibility", "Ignore semantics", "Rule precedence"],
  validationRequirements: ["lint"],
});

export const eslintFlatConfigRecipe = createDeterministicRecipe({
  metadata: ESLINT_FLAT_METADATA,
  target: "ESLINT_FLAT_CONFIG",
  matches(file) {
    return /(^|\/)\.eslintrc(?:\.json)?$/i.test(file.path);
  },
  detect(context) {
    const files = context.files.filter((file) => /(^|\/)\.eslintrc(?:\.json)?$/i.test(file.path));
    return {
      detected: files.length > 0,
      confidence: files.length > 0 ? 1 : 0,
      evidence: files.map((file) => `Legacy ESLint configuration detected at ${file.path}.`),
    };
  },
  transformFile(file) {
    return file.content ? transformEslintConfig(file.content) : undefined;
  },
});

export const JEST_TO_VITEST_METADATA = modernizationMetadata({
  id: "jest-to-vitest",
  name: "Jest to Vitest",
  description: "Converts supported Jest globals and configuration while preserving unsupported mocks for review.",
  sourceTechnology: "Jest",
  targetTechnology: "Vitest",
  filesItMayModify: ["<approved-scope>/**/*.{js,ts,jsx,tsx}", "vitest.config.ts"],
  knownLimitations: ["Custom Jest environments and transformer pipelines require manual review."],
  riskFactors: ["Mock hoisting", "Fake timers", "Snapshot serialization", "Test environment"],
  validationRequirements: ["vitest-run", "snapshot-parity"],
});

export const jestToVitestRecipe = createDeterministicRecipe({
  metadata: JEST_TO_VITEST_METADATA,
  target: "JEST_TO_VITEST",
  matches(file) {
    return (
      /\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(file.path) ||
      /(^|\/)jest\.config\.[cm]?[jt]s$/i.test(file.path)
    );
  },
  detect(context) {
    const files = context.files.filter(
      (file) =>
        /(^|\/)jest\.config\.[cm]?[jt]s$/i.test(file.path) ||
        (file.content && /\b(?:jest\.|describe\(|test\(|expect\()/.test(file.content)),
    );
    return {
      detected: files.length > 0,
      confidence: files.length > 0 ? 0.9 : 0,
      evidence: files.map((file) => `Jest test syntax detected in ${file.path}.`),
    };
  },
  transformFile(file) {
    if (!file.content) return undefined;
    return /(^|\/)jest\.config\.[cm]?[jt]s$/i.test(file.path)
      ? transformJestConfig(file.path, file.content)
      : transformJestTest(file.content);
  },
});

export const TYPED_ENV_METADATA = modernizationMetadata({
  id: "typed-env-config",
  name: "Environment variables to typed validated configuration",
  description: "Generates a typed environment boundary from statically referenced variables.",
  sourceTechnology: "process.env",
  targetTechnology: "typed validated configuration",
  filesItMayModify: ["src/env.ts"],
  knownLimitations: ["Runtime-specific secret stores and dynamically indexed variables require manual configuration."],
  riskFactors: ["Missing production variables", "Secret handling", "Runtime validation timing"],
  validationRequirements: ["typecheck", "environment-contract"],
});

export const typedEnvironmentRecipe = createDeterministicRecipe({
  metadata: TYPED_ENV_METADATA,
  target: "TYPED_ENV_CONFIG",
  matches(file) {
    return /\.[cm]?[jt]sx?$/i.test(file.path);
  },
  detect(context) {
    const variables = collectEnvironmentVariables(context.files.map((file) => file.content ?? ""));
    return {
      detected: variables.length > 0,
      confidence: variables.length > 0 ? 1 : 0,
      evidence: variables.map((variable) => `Environment variable ${variable} is referenced.`),
    };
  },
  transformFile(file, context) {
    if (!file.content || !/\bprocess\.env\.[A-Z][A-Z0-9_]*/.test(file.content)) return undefined;
    const firstEnvironmentFile = context.files
      .filter((entry) => entry.content && /\bprocess\.env\.[A-Z][A-Z0-9_]*/.test(entry.content))
      .map((entry) => entry.path)
      .sort()[0];
    if (file.path !== firstEnvironmentFile) return undefined;
    const variables = collectEnvironmentVariables(context.files.map((entry) => entry.content ?? ""));
    return {
      code: file.content,
      reason: "Preserved existing reads while generating a typed boundary for staged adoption.",
      confidence: 0.95,
      risk: "LOW",
      additionalChanges: [
        {
          path: "src/env.ts",
          code: generateTypedEnvironmentModule(variables),
          reason: "Generated a fail-fast typed environment contract without logging values.",
        },
      ],
    };
  },
});

const DEPRECATED: Readonly<Record<string, string>> = {
  request: "Deprecated HTTP client; evaluate undici or fetch.",
  "node-sass": "Unsupported native Sass binding; evaluate sass.",
  leftpad: "Obsolete utility dependency.",
  "babel-eslint": "Replaced by @babel/eslint-parser.",
};

export const DEPRECATED_DEPENDENCY_METADATA = modernizationMetadata({
  id: "deprecated-dependency-report",
  name: "Deprecated dependency report",
  description: "Produces an assessment-only report of known deprecated dependencies.",
  sourceTechnology: "npm dependency inventory",
  targetTechnology: "supported dependency alternatives",
  filesItMayModify: [],
  knownLimitations: ["No dependency is upgraded automatically."],
  riskFactors: ["Abandoned packages", "Native bindings", "Security advisories"],
  validationRequirements: ["dependency-audit"],
});

export const deprecatedDependencyRecipe = createDeterministicRecipe({
  metadata: DEPRECATED_DEPENDENCY_METADATA,
  target: "DEPRECATED_DEPENDENCY_REPORT",
  matches(file) {
    return /(^|\/)package\.json$/i.test(file.path);
  },
  detect(context) {
    const report = context.files
      .filter((file) => /(^|\/)package\.json$/i.test(file.path) && file.content)
      .flatMap((file) => deprecatedDependencyReport(file.content ?? ""));
    return {
      detected: report.length > 0,
      confidence: 1,
      evidence: report.map((entry) => `${entry.name}: ${entry.recommendation}`),
    };
  },
  transformFile(file) {
    if (!file.content) return undefined;
    const report = deprecatedDependencyReport(file.content);
    return {
      code: file.content,
      warnings: report.map((entry) => `${entry.name}: ${entry.recommendation}`),
      reason: "Assessment-only recipe; dependencies were not modified.",
      confidence: 1,
      risk: report.length > 0 ? "MEDIUM" : "LOW",
    };
  },
});

const EDGE_BLOCKERS = [
  "node:fs",
  "node:net",
  "node:tls",
  "node:child_process",
  "node:worker_threads",
] as const;

export const EDGE_RUNTIME_METADATA = modernizationMetadata({
  id: "edge-runtime-report",
  name: "Node runtime to edge-runtime compatibility report",
  description: "Reports Node-only APIs and produces no automatic runtime conversion.",
  sourceTechnology: "Node.js runtime",
  targetTechnology: "edge runtime compatibility",
  filesItMayModify: [],
  knownLimitations: ["Assessment-only; runtime target remains a human decision."],
  riskFactors: ["Node built-ins", "Native dependencies", "Filesystem access", "Long-lived sockets"],
  validationRequirements: ["edge-compatibility-report"],
});

export const edgeRuntimeReportRecipe = createDeterministicRecipe({
  metadata: EDGE_RUNTIME_METADATA,
  target: "EDGE_RUNTIME_REPORT",
  matches(file) {
    return /\.[cm]?[jt]sx?$/i.test(file.path);
  },
  detect(context) {
    const blockers = edgeRuntimeBlockers(context.files.map((file) => file.content ?? ""));
    return {
      detected: blockers.length > 0,
      confidence: 1,
      evidence: blockers.map((blocker) => `${blocker} requires a Node-compatible runtime.`),
    };
  },
  transformFile(file) {
    if (!file.content) return undefined;
    const blockers = edgeRuntimeBlockers([file.content]);
    return {
      code: file.content,
      warnings: blockers.map((blocker) => `${blocker} is unavailable in standard edge runtimes.`),
      reason: "Assessment-only recipe; runtime code was not modified.",
      confidence: 1,
      risk: blockers.length > 0 ? "HIGH" : "LOW",
    };
  },
});

export function transformEslintConfig(source: string): FileTransformResult {
  try {
    const legacy = JSON.parse(source) as {
      extends?: string | string[];
      rules?: Record<string, unknown>;
      ignorePatterns?: string[];
    };
    const extensions = Array.isArray(legacy.extends)
      ? legacy.extends
      : legacy.extends
        ? [legacy.extends]
        : [];
    const code = [
      'import { FlatCompat } from "@eslint/eslintrc";',
      'import { fileURLToPath } from "node:url";',
      "",
      "const compat = new FlatCompat({",
      "  baseDirectory: fileURLToPath(new URL('.', import.meta.url)),",
      "});",
      "",
      "export default [",
      ...(legacy.ignorePatterns?.length
        ? [`  { ignores: ${JSON.stringify(legacy.ignorePatterns)} },`]
        : []),
      ...(extensions.length
        ? [`  ...compat.extends(${extensions.map((entry) => JSON.stringify(entry)).join(", ")}),`]
        : []),
      `  { rules: ${JSON.stringify(legacy.rules ?? {}, null, 2).replaceAll("\n", "\n  ")} },`,
      "];",
      "",
    ].join("\n");
    return {
      code: source,
      reason: "Preserved the legacy config while generating a flat-config compatibility bridge.",
      confidence: 0.9,
      risk: "MEDIUM",
      additionalChanges: [
        {
          path: "eslint.config.mjs",
          code,
          reason: "Generated ESLint flat configuration.",
        },
      ],
    };
  } catch {
    return {
      code: source,
      warnings: ["Legacy ESLint JSON could not be parsed and was preserved."],
      reason: "Unsupported ESLint configuration was not modified.",
      risk: "HIGH",
    };
  }
}

export function transformJestTest(source: string): FileTransformResult {
  if (/\bjest\.(?:mock|doMock|isolateModules)\b/.test(source)) {
    return {
      code: source,
      warnings: ["Jest mock hoisting or module isolation requires manual review."],
      reason: "Unsupported Jest module-mocking semantics were preserved.",
      confidence: 1,
      risk: "HIGH",
    };
  }
  let code = source.replaceAll("jest.fn", "vi.fn").replaceAll("jest.spyOn", "vi.spyOn");
  if (code !== source && !/from\s+["']vitest["']/.test(code)) {
    code = `import { vi } from "vitest";\n${code}`;
  }
  return {
    code,
    reason: "Converted supported Jest mock helpers to Vitest.",
    confidence: 0.95,
    risk: "LOW",
    behaviourPotentiallyAffected: ["Mock reset and timer semantics"],
  };
}

export function transformJestConfig(
  sourcePath: string,
  source: string,
): FileTransformResult {
  const environment =
    source.match(/testEnvironment\s*:\s*["'](jsdom|node|happy-dom)["']/)?.[1] ??
    "node";
  const warnings = /\b(?:transform|moduleNameMapper|globalSetup|globalTeardown)\s*:/.test(
    source,
  )
    ? ["Complex Jest configuration was retained for manual mapping to Vitest."]
    : [];

  return {
    code: source,
    warnings,
    reason: `Retained ${sourcePath} while generating a staged Vitest configuration.`,
    confidence: warnings.length === 0 ? 0.9 : 0.7,
    risk: warnings.length === 0 ? "LOW" : "MEDIUM",
    unsupportedAssumptions: warnings,
    additionalChanges: [
      {
        path: "vitest.config.ts",
        code: [
          'import { defineConfig } from "vitest/config";',
          "",
          "export default defineConfig({",
          "  test: {",
          `    environment: "${environment}",`,
          "    globals: true,",
          "  },",
          "});",
          "",
        ].join("\n"),
        reason: "Generated a reviewable Vitest baseline beside the retained Jest configuration.",
      },
    ],
  };
}

export function generateTypedEnvironmentModule(variables: readonly string[]): string {
  const unique = [...new Set(variables)].sort();
  return [
    "const required = {",
    ...unique.map(
      (variable) =>
        `  ${variable}: readRequired(${JSON.stringify(variable)}),`,
    ),
    "} as const;",
    "",
    "function readRequired(name: string): string {",
    "  const value = process.env[name];",
    "  if (!value) throw new Error(`Missing required environment variable: ${name}`);",
    "  return value;",
    "}",
    "",
    "export const env = required;",
    "",
  ].join("\n");
}

export function deprecatedDependencyReport(source: string): Array<{
  name: string;
  recommendation: string;
}> {
  try {
    const manifest = JSON.parse(source) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return Object.keys({
      ...(manifest.dependencies ?? {}),
      ...(manifest.devDependencies ?? {}),
    })
      .filter((name) => DEPRECATED[name])
      .map((name) => ({ name, recommendation: DEPRECATED[name] }));
  } catch {
    return [];
  }
}

export function edgeRuntimeBlockers(sources: readonly string[]): string[] {
  const combined = sources.join("\n");
  return EDGE_BLOCKERS.filter(
    (module) =>
      combined.includes(`"${module}"`) || combined.includes(`'${module}'`),
  );
}

function collectEnvironmentVariables(sources: readonly string[]): string[] {
  return [
    ...new Set(
      sources.flatMap((source) =>
        [...source.matchAll(/\bprocess\.env\.([A-Z][A-Z0-9_]*)/g)].map(
          (match) => match[1],
        ),
      ),
    ),
  ].sort();
}
