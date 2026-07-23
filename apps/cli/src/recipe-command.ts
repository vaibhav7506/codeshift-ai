import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  loadLocalRecipeManifest,
  validateRecipeManifest,
  type RecipeSdkManifest,
} from "@codeshift/platform/recipe-sdk";

const RECIPES_DIRECTORY = join(".codeshift-ai", "recipes");

export async function runRecipeCommand(
  args: string[],
  cwd = process.cwd(),
  write: (text: string) => void = (text) => process.stdout.write(text),
): Promise<number> {
  const [action, recipeName, ...remaining] = args;
  if (!action || action === "help" || action === "--help") {
    write(recipeHelp());
    return 0;
  }
  if (!recipeName || remaining.length > 0) {
    throw new Error("Use codeshift-ai recipe <create|test|validate|inspect> <recipe-name>.");
  }
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(recipeName)) {
    throw new Error("Recipe names must use lowercase kebab-case.");
  }
  const root = resolve(cwd, RECIPES_DIRECTORY);
  if (action === "create") return createRecipe(root, recipeName, write);
  const manifest = await loadLocalRecipeManifest(root, recipeName);
  if (action === "validate") {
    const validation = validateRecipeManifest(manifest);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    write(`Recipe ${manifest.id}@${manifest.version} is valid.\n`);
    return 0;
  }
  if (action === "inspect") {
    write(formatInspection(manifest));
    return 0;
  }
  if (action === "test") return testRecipeFixture(root, manifest, write);
  throw new Error(`Unknown recipe command "${action}".`);
}

async function createRecipe(
  root: string,
  recipeName: string,
  write: (text: string) => void,
): Promise<number> {
  const directory = join(root, recipeName);
  await mkdir(join(directory, "src"), { recursive: true });
  await mkdir(join(directory, "fixtures"), { recursive: true });
  const manifest: RecipeSdkManifest = {
    manifestVersion: "1",
    id: recipeName,
    name: titleCase(recipeName),
    version: "0.1.0",
    description: `Controlled ${titleCase(recipeName)} modernization recipe.`,
    entrypoint: "src/index.ts",
    engineCompatibility: ">=0.1.0 <1.0.0",
    runtime: "node20",
    permissions: ["read-repository"],
    capabilities: ["detect", "assess", "plan", "validate", "explain"],
    validationCommands: ["npm test", "npm run typecheck"],
    fixtureDirectory: "fixtures",
    filesItMayModify: [],
    signedPackageRequired: false,
  };
  await writeFile(
    join(directory, "recipe.manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
  await writeFile(join(directory, "src", "index.ts"), recipeSource(recipeName), {
    encoding: "utf8",
    flag: "wx",
  });
  await writeFile(
    join(directory, "fixtures", "detection.json"),
    `${JSON.stringify({
      name: "detects supported repository",
      expectedDetection: true,
      evidence: ["Replace with stable file or manifest evidence."],
    }, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
  write(`Created recipe ${recipeName} in ${directory}\n`);
  return 0;
}

async function testRecipeFixture(
  root: string,
  manifest: RecipeSdkManifest,
  write: (text: string) => void,
): Promise<number> {
  const path = join(root, manifest.id, manifest.fixtureDirectory, "detection.json");
  const content = await readFile(path, "utf8");
  if (content.length > 64 * 1024) throw new Error("Recipe fixture exceeds 64 KiB.");
  const fixture: unknown = JSON.parse(content);
  if (
    !fixture ||
    typeof fixture !== "object" ||
    typeof (fixture as { name?: unknown }).name !== "string" ||
    typeof (fixture as { expectedDetection?: unknown }).expectedDetection !== "boolean" ||
    !Array.isArray((fixture as { evidence?: unknown }).evidence)
  ) {
    throw new Error("Detection fixture does not satisfy the SDK contract.");
  }
  write(`Recipe ${manifest.id}: 1 fixture contract passed. Source execution was not required.\n`);
  return 0;
}

function formatInspection(manifest: RecipeSdkManifest): string {
  return [
    `Recipe: ${manifest.name}`,
    `ID: ${manifest.id}`,
    `Version: ${manifest.version}`,
    `Engine: ${manifest.engineCompatibility}`,
    `Runtime: ${manifest.runtime}`,
    `Permissions: ${manifest.permissions.join(", ") || "none"}`,
    `Capabilities: ${manifest.capabilities.join(", ")}`,
    `Signed package required: ${manifest.signedPackageRequired ? "yes" : "no"}`,
    "",
  ].join("\n");
}

function recipeHelp(): string {
  return [
    "",
    "Recipe SDK",
    "  codeshift-ai recipe create <recipe-name>",
    "  codeshift-ai recipe test <recipe-name>",
    "  codeshift-ai recipe validate <recipe-name>",
    "  codeshift-ai recipe inspect <recipe-name>",
    "",
  ].join("\n");
}

function recipeSource(recipeName: string): string {
  return `import type { MigrationRecipe } from "@codeshift/platform";\n\n// Implement every declared capability before enabling transformation permissions.\nexport const recipe: MigrationRecipe = {\n  id: "${recipeName}",\n  version: "0.1.0",\n  name: "${titleCase(recipeName)}",\n} as MigrationRecipe;\n`;
}

function titleCase(value: string): string {
  return value.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
