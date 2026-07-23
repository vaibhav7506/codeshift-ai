import {
  createDeterministicRecipe,
  type FileTransformResult,
} from "./deterministic-recipe.js";
import { modernizationMetadata } from "./modernization-metadata.js";

const EXPRESS_PATTERN = /\brequire\s*\(\s*["']express["']\s*\)|from\s+["']express["']/;
const UNSUPPORTED_EXPRESS =
  /\b(?:express-session|multer|passport|socket\.io|res\.download|res\.sendFile|res\.write|req\.pipe|app\.ws|express\.static)\b/;

export const EXPRESS_TO_HONO_METADATA = modernizationMetadata({
  id: "express-to-hono",
  name: "Express to Hono",
  description:
    "Converts supported Express applications, routes, and middleware while preserving route order and reporting Node-specific blockers.",
  sourceTechnology: "Express",
  targetTechnology: "Hono",
  sourceVersions: ["Express 4.x", "Express 5.x"],
  targetVersions: ["Hono 4.x"],
  requiredTools: ["Node.js 20+", "Hono"],
  filesItMayModify: ["<approved-scope>/**/*.{js,ts}", "package.json"],
  dependencies: [],
  knownLimitations: [
    "Sessions, file uploads, streaming, WebSockets, and static assets are assessment-only.",
    "Runtime target selection remains explicit.",
    "Request augmentation is converted only for statically named properties.",
  ],
  riskFactors: [
    "Middleware order",
    "Authentication behaviour",
    "Error handlers",
    "Response helpers",
    "Node-specific dependencies",
  ],
  validationRequirements: [
    "route-parity",
    "response-parity",
    "middleware-order",
    "test",
    "typecheck",
  ],
});

export const expressToHonoRecipe = createDeterministicRecipe({
  metadata: EXPRESS_TO_HONO_METADATA,
  target: "EXPRESS_TO_HONO",

  matches(file) {
    return /\.[cm]?[jt]s$/i.test(file.path);
  },

  detect(context) {
    const expressFiles = context.files.filter(
      (file) => file.content && EXPRESS_PATTERN.test(file.content),
    );
    const unsupported = expressFiles.filter(
      (file) => file.content && UNSUPPORTED_EXPRESS.test(file.content),
    );
    return {
      detected: expressFiles.length > 0,
      confidence: expressFiles.length > 0 ? 0.98 : 0,
      evidence: [
        ...expressFiles.map((file) => `Express application boundary in ${file.path}.`),
        ...unsupported.map((file) => `Unsupported middleware or transport in ${file.path}.`),
      ],
    };
  },

  assess(context) {
    const source = context.files.map((file) => file.content ?? "").join("\n");
    const factors: string[] = [];
    let score = 40;
    if (/auth|passport|req\.user/i.test(source)) {
      score += 20;
      factors.push("Authentication or request augmentation is involved.");
    }
    if (UNSUPPORTED_EXPRESS.test(source)) {
      score += 30;
      factors.push("Unsupported session, upload, streaming, WebSocket, or static asset behaviour.");
    }
    if (/\(err,\s*req,\s*res,\s*next\)/.test(source)) {
      score += 10;
      factors.push("Express error middleware requires Hono onError conversion.");
    }
    return {
      level: score >= 85 ? "CRITICAL" : score >= 65 ? "HIGH" : "MEDIUM",
      score: Math.min(100, score),
      factors,
    };
  },

  transformFile(file) {
    return file.content ? transformExpressApplication(file.content) : undefined;
  },
});

export interface HonoRuntimeAssessment {
  runtime: "node" | "cloudflare-workers" | "vercel-edge";
  compatible: boolean;
  blockers: string[];
  deploymentHint: string;
}

export function assessHonoRuntimes(source: string): HonoRuntimeAssessment[] {
  const edgeBlockers: string[] = [];

  if (/\b(?:fs|path|net|tls|child_process|cluster)\b/.test(source)) {
    edgeBlockers.push("Node.js built-in modules require replacement or a compatibility layer.");
  }
  if (/\b(?:express-session|session\s*\()/.test(source)) {
    edgeBlockers.push("Node-specific sessions need an edge-compatible session store.");
  }
  if (/\b(?:res\.sendFile|res\.download|createReadStream)\b/.test(source)) {
    edgeBlockers.push("Filesystem-backed responses are unavailable on edge runtimes.");
  }

  return [
    {
      runtime: "node",
      compatible: true,
      blockers: [],
      deploymentHint: "Serve the Hono app with @hono/node-server.",
    },
    {
      runtime: "cloudflare-workers",
      compatible: edgeBlockers.length === 0,
      blockers: [...edgeBlockers],
      deploymentHint: "Export the Hono app as a Workers fetch handler.",
    },
    {
      runtime: "vercel-edge",
      compatible: edgeBlockers.length === 0,
      blockers: [...edgeBlockers],
      deploymentHint: "Export the Hono app from an Edge Runtime route.",
    },
  ];
}

export function transformExpressApplication(source: string): FileTransformResult {
  if (!EXPRESS_PATTERN.test(source)) {
    return {
      code: source,
      reason: "No Express application boundary was present.",
      confidence: 1,
      risk: "LOW",
    };
  }
  if (UNSUPPORTED_EXPRESS.test(source)) {
    return {
      code: source,
      warnings: ["Session, upload, streaming, WebSocket, static asset, or file response behaviour was preserved."],
      reason: "Unsupported Express capability requires a compatibility decision.",
      confidence: 1,
      risk: "HIGH",
      unsupportedAssumptions: [
        "No runtime target can be selected safely without reviewing the unsupported capability.",
      ],
    };
  }

  let code = source
    .replace(
      /(?:const\s+express\s*=\s*require\(\s*["']express["']\s*\);?|import\s+express\s+from\s+["']express["'];?)/,
      'import { Hono } from "hono";',
    )
    .replace(/\bconst\s+app\s*=\s*express\s*\(\s*\)\s*;?/g, "const app = new Hono();")
    .replace(
      /\b(?:express\.)?Router\s*\(\s*\)/g,
      "new Hono()",
    )
    .replace(/\((req),\s*(res)\)\s*=>/g, "(c) =>")
    .replace(/\((req),\s*(res),\s*(next)\)\s*=>/g, "(c, next) =>")
    .replace(/\breq\.params\.([A-Za-z_$][\w$]*)/g, 'c.req.param("$1")')
    .replace(/\breq\.query\.([A-Za-z_$][\w$]*)/g, 'c.req.query("$1")')
    .replace(/\breq\.body\b/g, "await c.req.json()")
    .replace(/\breq\.get\(\s*["']([^"']+)["']\s*\)/g, 'c.req.header("$1")')
    .replace(/\bres\.status\(\s*(\d+)\s*\)\.json\(([^;]+)\);?/g, "return c.json($2, $1);")
    .replace(/\bres\.json\(([^;]+)\);?/g, "return c.json($1);")
    .replace(/\bres\.send\(([^;]+)\);?/g, "return c.body($1);")
    .replace(/\bres\.status\(\s*(\d+)\s*\)\.send\(([^;]+)\);?/g, "return c.body($2, $1);")
    .replace(/\bnext\s*\(\s*\)\s*;?/g, "await next();")
    .replace(/\bapp\.listen\([\s\S]*?\);?/g, "")
    .replace(/\bmodule\.exports\s*=\s*app\s*;?/g, "export default app;");

  const warnings: string[] = [];
  if (/\breq\.|\bres\./.test(code)) {
    warnings.push("Some Express request or response helpers remain and require manual review.");
  }
  if (!/export\s+default\s+app/.test(code)) {
    code = `${code.trimEnd()}\n\nexport default app;\n`;
  }

  return {
    code,
    warnings,
    reason: "Converted the supported Express application and ordered route handlers to Hono.",
    confidence: warnings.length === 0 ? 0.9 : 0.7,
    risk: warnings.length === 0 ? "MEDIUM" : "HIGH",
    behaviourPotentiallyAffected: [
      "HTTP status and response encoding",
      "Middleware ordering",
      "Request parsing",
      "Error propagation",
    ],
    unsupportedAssumptions: warnings,
  };
}
