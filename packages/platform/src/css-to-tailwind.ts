import { createDeterministicRecipe } from "./deterministic-recipe.js";
import { modernizationMetadata } from "./modernization-metadata.js";

const DECLARATION_TO_UTILITY: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  display: {
    flex: "flex",
    grid: "grid",
    block: "block",
    none: "hidden",
  },
  "font-weight": {
    "400": "font-normal",
    "500": "font-medium",
    "600": "font-semibold",
    "700": "font-bold",
  },
  "text-align": {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  },
  position: {
    relative: "relative",
    absolute: "absolute",
    fixed: "fixed",
    sticky: "sticky",
  },
};

export interface TailwindSafeModeResult {
  originalCss: string;
  selectors: Array<{
    selector: string;
    utilities: string[];
    unresolvedDeclarations: string[];
  }>;
  mediaQueries: string[];
  designTokens: string[];
  darkModeSelectors: string[];
  repeatedDeclarations: Array<{ declaration: string; count: number }>;
  safeMode: true;
}

export const CSS_TO_TAILWIND_METADATA = modernizationMetadata({
  id: "css-to-tailwind",
  name: "CSS to Tailwind CSS",
  description:
    "Generates reviewable Tailwind utility suggestions while retaining original CSS until visual validation passes.",
  sourceTechnology: "CSS",
  targetTechnology: "Tailwind CSS",
  filesItMayModify: ["<approved-scope>/**/*.css", "<approved-scope>/**/*.tailwind.json"],
  knownLimitations: [
    "Original CSS is never removed in safe mode.",
    "Arbitrary values, complex selectors, and cascade dependencies remain for review.",
    "Generated utilities require screenshot and computed-style validation.",
  ],
  riskFactors: [
    "Cascade and specificity",
    "Responsive breakpoints",
    "Pseudo states",
    "Design tokens",
    "Computed style parity",
  ],
  validationRequirements: [
    "responsive-screenshots",
    "computed-style-parity",
    "accessibility",
    "test",
  ],
});

export const cssToTailwindRecipe = createDeterministicRecipe({
  metadata: CSS_TO_TAILWIND_METADATA,
  target: "CSS_TO_TAILWIND",

  matches(file) {
    return /\.css$/i.test(file.path);
  },

  detect(context) {
    const cssFiles = context.files.filter((file) => /\.css$/i.test(file.path));
    return {
      detected: cssFiles.length > 0,
      confidence: cssFiles.length > 0 ? 1 : 0,
      evidence: cssFiles.map((file) => `CSS stylesheet detected at ${file.path}.`),
    };
  },

  transformFile(file) {
    if (!file.content) return undefined;
    const result = generateTailwindSafeMode(file.content);
    return {
      code: file.content,
      reason: "Retained original CSS until visual validation passes.",
      confidence: 0.85,
      risk: "MEDIUM",
      behaviourPotentiallyAffected: ["Cascade", "Responsive layout", "Pseudo states"],
      unsupportedAssumptions: result.selectors.flatMap((selector) =>
        selector.unresolvedDeclarations.map(
          (declaration) => `${selector.selector}: ${declaration}`,
        ),
      ),
      additionalChanges: [
        {
          path: `${file.path}.tailwind.json`,
          code: `${JSON.stringify(result, null, 2)}\n`,
          reason: "Generated side-by-side Tailwind utility suggestions in safe mode.",
        },
      ],
    };
  },
});

export function generateTailwindSafeMode(source: string): TailwindSafeModeResult {
  const allDeclarations: string[] = [];
  const selectors = [...source.matchAll(/([^{}@]+)\{([^{}]+)\}/g)].map(
    (match) => {
      const selector = match[1].trim();
      const declarations = match[2]
        .split(";")
        .map((declaration) => declaration.trim())
        .filter(Boolean);
      allDeclarations.push(...declarations.map((declaration) => declaration.toLowerCase()));
      const utilities: string[] = [];
      const unresolvedDeclarations: string[] = [];

      for (const declaration of declarations) {
        const colon = declaration.indexOf(":");
        if (colon === -1) {
          unresolvedDeclarations.push(declaration);
          continue;
        }
        const property = declaration.slice(0, colon).trim().toLowerCase();
        const value = declaration.slice(colon + 1).trim().toLowerCase();
        const utility = mapDeclaration(property, value);
        if (utility) utilities.push(withPseudoPrefix(selector, utility));
        else unresolvedDeclarations.push(declaration);
      }

      return {
        selector,
        utilities: [...new Set(utilities)],
        unresolvedDeclarations,
      };
    },
  );

  return {
    originalCss: source,
    selectors,
    mediaQueries: [...source.matchAll(/@media\s*([^{]+)\{/g)].map((match) => match[1].trim()),
    designTokens: [
      ...new Set(
        [...source.matchAll(/(--[A-Za-z0-9-_]+)\s*:/g)].map((match) => match[1]),
      ),
    ].sort(),
    darkModeSelectors: selectors
      .map((selector) => selector.selector)
      .filter((selector) => /\.dark\b|prefers-color-scheme:\s*dark/.test(selector)),
    repeatedDeclarations: [...new Set(allDeclarations)]
      .map((declaration) => ({
        declaration,
        count: allDeclarations.filter((candidate) => candidate === declaration).length,
      }))
      .filter((entry) => entry.count > 1),
    safeMode: true,
  };
}

function mapDeclaration(property: string, value: string): string | undefined {
  const direct = DECLARATION_TO_UTILITY[property]?.[value];
  if (direct) return direct;
  if (property === "color" && value.startsWith("var(")) {
    return `text-[${value}]`;
  }
  if (property === "background-color" && value.startsWith("var(")) {
    return `bg-[${value}]`;
  }
  if (/^(margin|padding)(-(top|right|bottom|left))?$/.test(property)) {
    return undefined;
  }
  return undefined;
}

function withPseudoPrefix(selector: string, utility: string): string {
  if (selector.includes(":hover")) return `hover:${utility}`;
  if (selector.includes(":focus")) return `focus:${utility}`;
  if (selector.includes(":active")) return `active:${utility}`;
  return utility;
}
