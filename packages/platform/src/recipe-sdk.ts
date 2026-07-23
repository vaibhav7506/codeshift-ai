import { createHash, verify } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import type {
  MigrationRecipe,
  RecipeCapability,
  RecipeMetadata,
  RecipePermission,
  RepositoryContext,
} from "./recipe.js";

export const RECIPE_MANIFEST_VERSION = "1";

export interface RecipeSdkManifest {
  manifestVersion: typeof RECIPE_MANIFEST_VERSION;
  id: string;
  name: string;
  version: string;
  description: string;
  entrypoint: string;
  engineCompatibility: string;
  runtime: "node20" | "dotnet8";
  permissions: RecipePermission[];
  capabilities: RecipeCapability[];
  validationCommands: string[];
  fixtureDirectory: string;
  filesItMayModify: string[];
  signedPackageRequired: boolean;
}

export interface RecipeManifestValidation {
  valid: boolean;
  errors: string[];
}

export function validateRecipeManifest(value: unknown): RecipeManifestValidation {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["Manifest must be an object."] };
  if (value.manifestVersion !== RECIPE_MANIFEST_VERSION) errors.push("Unsupported manifestVersion.");
  if (!isSlug(value.id)) errors.push("id must be a lowercase kebab-case slug.");
  if (!isBounded(value.name, 100)) errors.push("name is required.");
  if (!isSemver(value.version)) errors.push("version must use semantic versioning.");
  if (!isBounded(value.description, 500)) errors.push("description is required.");
  if (!isSafeRelativeFile(value.entrypoint)) errors.push("entrypoint must be a safe relative file.");
  if (!isBounded(value.engineCompatibility, 50)) errors.push("engineCompatibility is required.");
  if (value.runtime !== "node20" && value.runtime !== "dotnet8") errors.push("runtime is not supported.");
  if (!isStringArray(value.permissions, 20)) errors.push("permissions must be a bounded list.");
  if (!isStringArray(value.capabilities, 20)) errors.push("capabilities must be a bounded list.");
  if (!isStringArray(value.validationCommands, 20)) errors.push("validationCommands must be a bounded list.");
  if (!isSafeRelativeFile(value.fixtureDirectory)) errors.push("fixtureDirectory must be relative.");
  if (!isStringArray(value.filesItMayModify, 100)) errors.push("filesItMayModify must be bounded.");
  if (typeof value.signedPackageRequired !== "boolean") errors.push("signedPackageRequired must be boolean.");
  return { valid: errors.length === 0, errors };
}

export async function loadLocalRecipeManifest(
  recipesRoot: string,
  recipeName: string,
): Promise<RecipeSdkManifest> {
  if (!isSlug(recipeName)) throw new Error("Recipe name must be a lowercase kebab-case slug.");
  const root = resolve(recipesRoot);
  const manifestPath = resolve(join(root, recipeName, "recipe.manifest.json"));
  if (isAbsolute(relative(root, manifestPath)) || relative(root, manifestPath).startsWith("..")) {
    throw new Error("Recipe manifest escaped the configured recipe root.");
  }
  const content = await readFile(manifestPath, "utf8");
  if (content.length > 64 * 1024) throw new Error("Recipe manifest exceeds 64 KiB.");
  const parsed: unknown = JSON.parse(content);
  const validation = validateRecipeManifest(parsed);
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  return parsed as unknown as RecipeSdkManifest;
}

export interface RecipeFixture {
  name: string;
  expectedDetection: boolean;
  context: RepositoryContext;
}

export async function runRecipeFixtures(
  recipe: MigrationRecipe,
  fixtures: readonly RecipeFixture[],
): Promise<Array<{ name: string; passed: boolean; detail: string }>> {
  const results = [];
  for (const fixture of fixtures) {
    try {
      const detection = await recipe.detect(fixture.context);
      const passed = detection.detected === fixture.expectedDetection;
      results.push({
        name: fixture.name,
        passed,
        detail: passed ? "Detection matched." : "Detection did not match fixture expectation.",
      });
    } catch (error) {
      results.push({
        name: fixture.name,
        passed: false,
        detail: error instanceof Error ? error.message : "Fixture failed.",
      });
    }
  }
  return results;
}

export interface SignedRecipePackage {
  manifest: RecipeSdkManifest;
  archiveSha256: string;
  signerId: string;
  signature: string;
}

export class TrustedRecipeSigners {
  constructor(private readonly publicKeys: ReadonlyMap<string, string>) {}

  verifyPackage(recipePackage: SignedRecipePackage): boolean {
    const publicKey = this.publicKeys.get(recipePackage.signerId);
    if (!publicKey || !/^[a-f0-9]{64}$/i.test(recipePackage.archiveSha256)) return false;
    const payload = Buffer.from(JSON.stringify({
      manifest: recipePackage.manifest,
      archiveSha256: recipePackage.archiveSha256,
      signerId: recipePackage.signerId,
    }));
    return verify(
      "sha256",
      payload,
      publicKey,
      Buffer.from(recipePackage.signature, "base64"),
    );
  }
}

export function recipeCompatibilityMetadata(
  metadata: RecipeMetadata,
  manifest: RecipeSdkManifest,
): Record<string, unknown> {
  return {
    recipe: `${metadata.id}@${metadata.version}`,
    engineCompatibility: manifest.engineCompatibility,
    runtime: manifest.runtime,
    permissions: [...metadata.permissions],
    packageDigest: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSlug(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);
}

function isSemver(value: unknown): value is string {
  return typeof value === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(value);
}

function isBounded(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function isSafeRelativeFile(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 300 &&
    !isAbsolute(value) &&
    !value.split(/[\\/]/).includes("..");
}

function isStringArray(value: unknown, maximum: number): value is string[] {
  return Array.isArray(value) &&
    value.length <= maximum &&
    value.every((entry) => typeof entry === "string" && entry.length <= 300);
}
