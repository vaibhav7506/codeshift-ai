import {
  createDeterministicRecipe,
  type FileTransformResult,
} from "./deterministic-recipe.js";
import { modernizationMetadata } from "./modernization-metadata.js";

const CLASS_COMPONENT_PATTERN =
  /class\s+([A-Za-z_$][\w$]*)\s+extends\s+(?:React\.)?(?:Pure)?Component\s*\{/;
const UNSUPPORTED_REACT_PATTERN =
  /\b(?:componentDidCatch|getDerivedStateFromError|getDerivedStateFromProps|UNSAFE_|createRef|this\.context)\b/;

export const REACT_CLASSES_TO_HOOKS_METADATA = modernizationMetadata({
  id: "classes-to-hooks",
  name: "React classes to hooks",
  description:
    "Converts supported React class components to functions while mapping state and lifecycle cleanup explicitly.",
  category: "frontend-styling",
  sourceTechnology: "React class components",
  targetTechnology: "React hooks",
  filesItMayModify: ["<approved-scope>/**/*.{jsx,tsx}"],
  knownLimitations: [
    "Error boundaries remain class components.",
    "Derived state, legacy lifecycles, and complex refs require manual review.",
    "setState callback semantics are not transformed without behavioural fixtures.",
  ],
  riskFactors: [
    "Lifecycle ordering",
    "setState callbacks",
    "Subscriptions",
    "Derived state",
    "Error boundaries",
  ],
});

export const reactClassesToHooksRecipe = createDeterministicRecipe({
  metadata: REACT_CLASSES_TO_HOOKS_METADATA,
  target: "REACT_CLASSES_TO_HOOKS",

  matches(file) {
    return /\.[jt]sx$/i.test(file.path);
  },

  detect(context) {
    const supported = context.files.filter(
      (file) =>
        file.content &&
        CLASS_COMPONENT_PATTERN.test(file.content) &&
        !UNSUPPORTED_REACT_PATTERN.test(file.content),
    );
    const unsupported = context.files.filter(
      (file) => file.content && UNSUPPORTED_REACT_PATTERN.test(file.content),
    );
    return {
      detected: supported.length > 0,
      confidence: supported.length > 0 ? 0.9 : 0,
      evidence: [
        ...supported.map((file) => `Supported class component detected in ${file.path}.`),
        ...unsupported.map((file) => `Unsupported lifecycle or error boundary in ${file.path}.`),
      ],
    };
  },

  transformFile(file) {
    return file.content ? transformReactClass(file.content) : undefined;
  },
});

export function transformReactClass(source: string): FileTransformResult {
  if (UNSUPPORTED_REACT_PATTERN.test(source)) {
    return {
      code: source,
      warnings: ["Error boundary, derived state, legacy lifecycle, context, or complex ref was preserved."],
      reason: "Unsupported class semantics require manual review.",
      confidence: 1,
      risk: "HIGH",
    };
  }

  const classMatch = CLASS_COMPONENT_PATTERN.exec(source);
  const renderMatch = /\brender\s*\(\s*\)\s*\{\s*return\s*\(([\s\S]*?)\);?\s*\}\s*\}?/m.exec(source);
  if (!classMatch || !renderMatch) {
    return {
      code: source,
      warnings: ["Class component shape is outside the supported deterministic subset."],
      reason: "Unsupported component structure was preserved.",
      confidence: 1,
      risk: "MEDIUM",
    };
  }
  const methodNames = [
    ...source.matchAll(/^\s{2}([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm),
  ].map((match) => match[1]);
  const unsupportedMethods = methodNames.filter(
    (name) =>
      !["componentDidMount", "componentWillUnmount", "render"].includes(name),
  );
  if (unsupportedMethods.length > 0) {
    return {
      code: source,
      warnings: [
        `Instance methods require explicit closure conversion: ${unsupportedMethods.join(", ")}.`,
      ],
      reason: "Instance method identity and binding were not transformed silently.",
      confidence: 1,
      risk: "HIGH",
    };
  }

  const componentName = classMatch[1];
  const stateMatch = /\bstate\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*:\s*([^,}]+)\s*\};?/m.exec(source);
  const mountMatch = /\bcomponentDidMount\s*\(\s*\)\s*\{([\s\S]*?)\n\s*\}/m.exec(source);
  const unmountMatch = /\bcomponentWillUnmount\s*\(\s*\)\s*\{([\s\S]*?)\n\s*\}/m.exec(source);
  const updateMatch = /\bcomponentDidUpdate\s*\(/.test(source);

  if (updateMatch) {
    return {
      code: source,
      warnings: ["componentDidUpdate requires an explicit dependency comparison and was preserved."],
      reason: "Update lifecycle dependencies could not be proven.",
      confidence: 1,
      risk: "HIGH",
    };
  }

  let jsx = renderMatch[1]
    .replaceAll("this.props.", "props.")
    .replaceAll("this.state.", "");
  const hookLines: string[] = [];
  const imports: string[] = [];

  if (stateMatch) {
    const stateName = stateMatch[1];
    const setter = `set${stateName[0].toUpperCase()}${stateName.slice(1)}`;
    imports.push("useState");
    hookLines.push(`  const [${stateName}, ${setter}] = useState(${stateMatch[2].trim()});`);
    jsx = jsx.replace(
      new RegExp(`this\\.setState\\(\\{\\s*${stateName}\\s*:\\s*([^}]+)\\}\\)`, "g"),
      `${setter}($1)`,
    );
  }

  if (mountMatch || unmountMatch) {
    imports.push("useEffect");
    const mountBody = (mountMatch?.[1] ?? "").trim().replaceAll("this.", "");
    const cleanupBody = (unmountMatch?.[1] ?? "").trim().replaceAll("this.", "");
    hookLines.push(
      [
        "  useEffect(() => {",
        ...(mountBody ? mountBody.split("\n").map((line) => `    ${line.trim()}`) : []),
        ...(cleanupBody
          ? [
              "    return () => {",
              ...cleanupBody.split("\n").map((line) => `      ${line.trim()}`),
              "    };",
            ]
          : []),
        "  }, []);",
      ].join("\n"),
    );
  }

  const code = [
    ...(
      imports.length > 0
        ? [`import { ${[...new Set(imports)].sort().join(", ")} } from "react";`, ""]
        : []
    ),
    `export function ${componentName}(props) {`,
    ...hookLines,
    "",
    `  return (${jsx.trim()});`,
    "}",
    "",
  ].join("\n");

  return {
    code,
    reason: "Converted supported state and mount/unmount lifecycle behaviour to hooks.",
    confidence: 0.86,
    risk: "MEDIUM",
    behaviourPotentiallyAffected: ["Lifecycle timing", "State batching", "Subscription cleanup"],
    unsupportedAssumptions: [
      "The component does not depend on instance identity outside React.",
    ],
  };
}
