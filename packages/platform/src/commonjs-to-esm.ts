import {
  createDeterministicRecipe,
  type FileTransformResult,
} from "./deterministic-recipe.js";
import { modernizationMetadata } from "./modernization-metadata.js";

const SOURCE_PATTERN = /\.[cm]?[jt]sx?$/i;
const DYNAMIC_REQUIRE = /\brequire\s*\(\s*(?!["'`])/;
const CONDITIONAL_REQUIRE = /\b(?:if|switch)\b[\s\S]{0,120}\brequire\s*\(/;

export const COMMONJS_TO_ESM_METADATA = modernizationMetadata({
  id: "commonjs-to-esm",
  name: "CommonJS to ESM",
  description:
    "Converts statically provable CommonJS boundaries and reports dynamic or configuration-sensitive cases.",
  sourceTechnology: "CommonJS",
  targetTechnology: "ECMAScript modules",
  sourceVersions: ["Node.js CommonJS"],
  targetVersions: ["Node.js 20+ ESM"],
  filesItMayModify: [
    "<approved-scope>/**/*.{js,cjs,ts,cts}",
    "package.json",
    "tsconfig.json",
  ],
  knownLimitations: [
    "Dynamic and conditional require calls remain unchanged.",
    "Mixed-module configuration files require manual review.",
    "JSON imports are reported unless an assertion strategy is already configured.",
  ],
  riskFactors: [
    "Dynamic require",
    "Conditional imports",
    "JSON modules",
    "Test runner configuration",
    "Mixed module repositories",
  ],
});

export const commonJsToEsmRecipe = createDeterministicRecipe({
  metadata: COMMONJS_TO_ESM_METADATA,
  target: "COMMONJS_TO_ESM",

  matches(file) {
    return (
      SOURCE_PATTERN.test(file.path) ||
      /(^|\/)(package|tsconfig)\.json$/i.test(file.path)
    );
  },

  detect(context) {
    const candidates = context.files.filter(
      (file) =>
        file.content !== undefined &&
        /\brequire\s*\(|\bmodule\.exports\b|\bexports\./.test(file.content),
    );
    return {
      detected: candidates.length > 0,
      confidence: candidates.length > 0 ? 0.98 : 0,
      evidence: candidates.map((file) => `CommonJS syntax detected in ${file.path}.`),
    };
  },

  assess(context) {
    const sources = context.files.map((file) => file.content ?? "").join("\n");
    const factors: string[] = [];
    let score = 25;
    if (DYNAMIC_REQUIRE.test(sources)) {
      score += 35;
      factors.push("Dynamic require calls cannot be proven safe.");
    }
    if (CONDITIONAL_REQUIRE.test(sources)) {
      score += 25;
      factors.push("Conditional require calls may alter load timing.");
    }
    if (/require\s*\(\s*["'][^"']+\.json["']/.test(sources)) {
      score += 15;
      factors.push("JSON import semantics require runtime-specific assertions.");
    }
    return {
      level: score >= 85 ? "CRITICAL" : score >= 65 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW",
      score: Math.min(100, score),
      factors,
    };
  },

  transformFile(file) {
    if (!file.content) return undefined;
    if (/package\.json$/i.test(file.path)) {
      return transformPackageJson(file.content);
    }
    if (/tsconfig\.json$/i.test(file.path)) {
      return transformTsConfig(file.content);
    }
    return transformCommonJsModule(file.content);
  },
});

export function transformCommonJsModule(source: string): FileTransformResult {
  const warnings: string[] = [];
  if (DYNAMIC_REQUIRE.test(source)) {
    return {
      code: source,
      warnings: ["Dynamic require was preserved for manual review."],
      reason: "Unsafe dynamic module resolution was not transformed.",
      confidence: 1,
      risk: "HIGH",
      unsupportedAssumptions: ["The runtime value passed to require is unknown."],
    };
  }
  if (CONDITIONAL_REQUIRE.test(source)) {
    return {
      code: source,
      warnings: ["Conditional require was preserved to avoid changing load timing."],
      reason: "Conditional module loading was not transformed.",
      confidence: 1,
      risk: "HIGH",
      unsupportedAssumptions: ["Hoisting the import may change behaviour."],
    };
  }
  if (/\brequire\s*\(\s*["'][^"']+\.json["']\s*\)/.test(source)) {
    return {
      code: source,
      warnings: ["JSON require was preserved until an import-assertion strategy is approved."],
      reason: "JSON module semantics vary by runtime and were not transformed silently.",
      confidence: 1,
      risk: "MEDIUM",
      unsupportedAssumptions: ["The target runtime's JSON import syntax is not configured."],
    };
  }

  let code = source
    .replace(
      /^(\s*)const\s+\{\s*([^}]+)\s*\}\s*=\s*require\(\s*["']([^"']+)["']\s*\);?\s*$/gm,
      (_match, indentation: string, names: string, moduleName: string) =>
        `${indentation}import { ${names.trim()} } from "${moduleName}";`,
    )
    .replace(
      /^(\s*)const\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*["']([^"']+)["']\s*\);?\s*$/gm,
      '$1import $2 from "$3";',
    )
    .replace(
      /^(\s*)module\.exports\s*=\s*(.+);?\s*$/gm,
      "$1export default $2",
    )
    .replace(
      /^(\s*)exports\.([A-Za-z_$][\w$]*)\s*=\s*(.+);?\s*$/gm,
      "$1export const $2 = $3",
    );

  if (/\brequire\s*\(/.test(code) || /\b(?:module\.exports|exports\.)/.test(code)) {
    warnings.push("Unsupported CommonJS syntax remains and requires review.");
  }

  const needsFilename = /\b__filename\b/.test(code);
  const needsDirname = /\b__dirname\b/.test(code);
  if (needsFilename || needsDirname) {
    const declarations = [
      'import { fileURLToPath } from "node:url";',
      ...(needsDirname ? ['import { dirname } from "node:path";'] : []),
      "const __filename = fileURLToPath(import.meta.url);",
      ...(needsDirname ? ["const __dirname = dirname(__filename);"] : []),
      "",
    ].join("\n");
    code = `${declarations}${code}`;
  }

  return {
    code,
    warnings,
    reason: "Converted statically provable CommonJS imports and exports to ESM.",
    confidence: warnings.length === 0 ? 0.98 : 0.75,
    risk: warnings.length === 0 ? "LOW" : "MEDIUM",
    behaviourPotentiallyAffected: ["Module initialization order", "Default export interop"],
    unsupportedAssumptions: warnings,
  };
}

function transformPackageJson(source: string): FileTransformResult | undefined {
  try {
    const value = JSON.parse(source) as Record<string, unknown>;
    if (value.type === "module") return undefined;
    value.type = "module";
    return {
      code: `${JSON.stringify(value, null, 2)}\n`,
      reason: "Declared the package ESM module boundary.",
      risk: "MEDIUM",
      behaviourPotentiallyAffected: ["Configuration-file module loading"],
      unsupportedAssumptions: [
        "Configuration files using CommonJS may need a .cjs extension.",
      ],
    };
  } catch {
    return {
      code: source,
      warnings: ["package.json could not be parsed and was preserved."],
      reason: "Invalid package configuration was not modified.",
      risk: "HIGH",
    };
  }
}

function transformTsConfig(source: string): FileTransformResult | undefined {
  try {
    const value = JSON.parse(source) as {
      compilerOptions?: Record<string, unknown>;
    };
    value.compilerOptions ??= {};
    if (
      value.compilerOptions.module === "NodeNext" &&
      value.compilerOptions.moduleResolution === "NodeNext"
    ) {
      return undefined;
    }
    value.compilerOptions.module = "NodeNext";
    value.compilerOptions.moduleResolution = "NodeNext";
    return {
      code: `${JSON.stringify(value, null, 2)}\n`,
      reason: "Aligned TypeScript module emit and resolution with Node ESM.",
      risk: "MEDIUM",
      behaviourPotentiallyAffected: ["TypeScript module resolution"],
    };
  } catch {
    return {
      code: source,
      warnings: ["Commented or invalid tsconfig requires manual update."],
      reason: "Non-standard TypeScript configuration was preserved.",
      risk: "MEDIUM",
    };
  }
}
