import {
  createDeterministicRecipe,
  type FileTransformResult,
} from "./deterministic-recipe.js";
import { modernizationMetadata } from "./modernization-metadata.js";

const CALLBACK_API_PATTERN =
  /\b(readFile|writeFile|stat|readdir|mkdir|unlink|rename)\s*\(([\s\S]*?),\s*\((err(?:or)?),\s*([A-Za-z_$][\w$]*)\)\s*=>\s*\{\s*if\s*\(\3\)\s*(?:\{\s*)?return\s+callback\(\3\);?(?:\s*\})?\s*callback\(null,\s*\4\);?\s*\}\s*\);?/m;

export const CALLBACKS_TO_ASYNC_METADATA = modernizationMetadata({
  id: "callbacks-to-async",
  name: "Callbacks to async/await",
  description:
    "Converts narrow Node-style error-first callback wrappers while preserving error propagation and sequencing.",
  category: "language-modules",
  sourceTechnology: "Node.js error-first callbacks",
  targetTechnology: "async/await",
  filesItMayModify: ["<approved-scope>/**/*.{js,ts}"],
  knownLimitations: [
    "Event emitters, streams, timers, and timing-sensitive callbacks remain unchanged.",
    "Parallel callback orchestration is transformed only when ordering can be proven.",
    "Cleanup-heavy callbacks require an explicit finally contract.",
  ],
  riskFactors: [
    "Error propagation",
    "Parallel execution",
    "Cleanup logic",
    "Early returns",
    "Timing-sensitive behaviour",
  ],
});

export const callbacksToAsyncRecipe = createDeterministicRecipe({
  metadata: CALLBACKS_TO_ASYNC_METADATA,
  target: "CALLBACKS_TO_ASYNC",

  matches(file) {
    return /\.[cm]?[jt]s$/i.test(file.path);
  },

  detect(context) {
    const supported = context.files.filter(
      (file) => file.content && CALLBACK_API_PATTERN.test(file.content),
    );
    const unsafe = context.files.filter(
      (file) =>
        file.content &&
        /\b(?:on|once|addEventListener|setTimeout|setInterval)\s*\(/.test(file.content),
    );
    return {
      detected: supported.length > 0,
      confidence: supported.length > 0 ? 0.9 : 0,
      evidence: [
        ...supported.map((file) => `Supported error-first callback wrapper in ${file.path}.`),
        ...unsafe.map((file) => `Timing or event callback requires review in ${file.path}.`),
      ],
    };
  },

  transformFile(file) {
    return file.content ? transformCallbackWrapper(file.content) : undefined;
  },
});

export function transformCallbackWrapper(source: string): FileTransformResult {
  if (/\b(?:on|once|addEventListener|setTimeout|setInterval)\s*\(/.test(source)) {
    return {
      code: source,
      warnings: ["Event, stream, or timing callback was preserved."],
      reason: "Timing-sensitive callbacks are outside the safe deterministic subset.",
      confidence: 1,
      risk: "HIGH",
      unsupportedAssumptions: ["Callback timing and repeated invocation cannot be changed safely."],
    };
  }

  const match = CALLBACK_API_PATTERN.exec(source);
  if (!match) {
    return {
      code: source,
      warnings: ["Callback shape is not in the supported error-first subset."],
      reason: "Unsupported callback control flow was preserved.",
      confidence: 1,
      risk: "MEDIUM",
    };
  }

  const [full, api, args, , resultName] = match;
  const asyncApi = `${api}Async`;
  let code = source.replace(full, `const ${resultName} = await ${asyncApi}(${args.trim()});\n  return ${resultName};`);
  code = code.replace(
    /function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*?),?\s*callback\s*\)\s*\{/,
    "async function $1($2) {",
  );

  if (!code.includes(`promisify(${api})`)) {
    code = [
      'import { promisify } from "node:util";',
      `const ${asyncApi} = promisify(${api});`,
      "",
      code,
    ].join("\n");
  }

  return {
    code,
    reason: "Converted a Node-style error-first callback wrapper to awaited promise control flow.",
    confidence: 0.92,
    risk: "MEDIUM",
    behaviourPotentiallyAffected: ["Error propagation", "Function return type"],
    unsupportedAssumptions: [
      `${api} follows the Node error-first callback contract and calls back once.`,
    ],
  };
}
