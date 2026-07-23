import { XMLParser } from "fast-xml-parser";
import type { RecipeFile } from "./recipe.js";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
  processEntities: false,
});
const MAX_XML_BYTES = 5_000_000;
const MAX_MANIFEST_BYTES = 10_000_000;

export interface DotNetTargetConfiguration {
  targetFramework: string;
  aspNetCoreTargetFramework: string;
  allowWindowsCompatibility: boolean;
  containerTarget: "linux" | "windows" | "none";
}

export interface DotNetPackageReference {
  name: string;
  version?: string;
  source: "PackageReference" | "packages.config";
}

export interface DotNetProjectAnalysis {
  path: string;
  name: string;
  sdkStyle: boolean;
  sdk?: string;
  targetFrameworks: string[];
  outputType?: string;
  projectReferences: string[];
  packageReferences: DotNetPackageReference[];
  assemblyReferences: string[];
  imports: string[];
  hasCustomBuildLogic: boolean;
  hasComReferences: boolean;
  hasNativeDependencies: boolean;
  usesSystemWeb: boolean;
  usesEntityFramework6: boolean;
  usesWcf: boolean;
  usesWindowsService: boolean;
}

export interface DotNetRouteManifest {
  method: string;
  template: string;
  controller: string;
  action: string;
  authorization: string[];
}

export interface DotNetSemanticProject {
  path: string;
  controllers: Array<{
    name: string;
    baseType: string;
    routes: DotNetRouteManifest[];
    filters: string[];
    systemWebUsages: string[];
  }>;
  efContexts: Array<{
    name: string;
    provider?: string;
    features: string[];
    entities: string[];
  }>;
  wcfServices: Array<{
    contract: string;
    operations: string[];
    bindings: string[];
    hasDuplex: boolean;
    hasStreaming: boolean;
    usesTransactions: boolean;
  }>;
  windowsServices: Array<{
    name: string;
    lifecycleMethods: string[];
  }>;
}

export interface DotNetSemanticManifest {
  schemaVersion: 1;
  generatedBy: string;
  projects: DotNetSemanticProject[];
}

export interface DotNetRepositoryReport {
  solutions: Array<{ path: string; projects: string[] }>;
  projects: DotNetProjectAnalysis[];
  semanticManifest?: DotNetSemanticManifest;
  targetConfiguration?: DotNetTargetConfiguration;
  frameworkCompatibility: string[];
  nugetCompatibility: string[];
  windowsDependencies: string[];
  systemWebUsages: string[];
  iisDependencies: string[];
  aspNetRoutes: DotNetRouteManifest[];
  efCompatibility: string[];
  wcfRecommendations: string[];
  linuxReadinessScore: number;
  containerReadinessScore: number;
  blockers: string[];
}

export function analyzeDotNetRepository(
  files: readonly RecipeFile[],
): DotNetRepositoryReport {
  const ingestionBlockers: string[] = [];
  let targetConfiguration: DotNetTargetConfiguration | undefined;
  let semanticManifest: DotNetSemanticManifest | undefined;
  try {
    targetConfiguration = readDotNetTargetConfiguration(files);
  } catch (error) {
    ingestionBlockers.push(errorMessage(error));
  }
  try {
    semanticManifest = readDotNetSemanticManifest(files);
  } catch (error) {
    ingestionBlockers.push(errorMessage(error));
  }
  const packageConfigByDirectory = new Map<
    string,
    DotNetPackageReference[]
  >();
  for (const file of files.filter((entry) =>
    /(^|\/)packages\.config$/i.test(normalize(entry.path)),
  )) {
    try {
      packageConfigByDirectory.set(
        directoryOf(file.path),
        file.content ? parsePackagesConfig(file.content) : [],
      );
    } catch (error) {
      ingestionBlockers.push(`${file.path}: ${errorMessage(error)}`);
    }
  }
  const projects: DotNetProjectAnalysis[] = [];
  for (const file of files.filter(
    (entry) => /\.(?:cs|vb|fs)proj$/i.test(entry.path) && entry.content,
  )) {
    try {
      projects.push(
        parseMsBuildProject(
          file.path,
          file.content ?? "",
          packageConfigByDirectory.get(directoryOf(file.path)) ?? [],
        ),
      );
    } catch (error) {
      ingestionBlockers.push(`${file.path}: ${errorMessage(error)}`);
    }
  }
  const solutions = files
    .filter((file) => /\.sln$/i.test(file.path) && file.content)
    .map((file) => ({
      path: file.path,
      projects: parseSolutionProjects(file.content ?? ""),
    }));
  const configFiles = files.filter(
    (file) => /(^|\/)(web|app)\.config$/i.test(normalize(file.path)) && file.content,
  );
  const configurationInspections = configFiles.flatMap((file) => {
    try {
      return [inspectConfiguration(file.path, file.content ?? "")];
    } catch (error) {
      ingestionBlockers.push(`${file.path}: ${errorMessage(error)}`);
      return [];
    }
  });
  const iisDependencies = configurationInspections.flatMap(
    (inspection) => inspection.iisDependencies,
  );
  const configWcf = configurationInspections.flatMap(
    (inspection) => inspection.wcfBindings,
  );
  const aspNetRoutes =
    semanticManifest?.projects.flatMap((project) =>
      project.controllers.flatMap((controller) => controller.routes),
    ) ?? [];
  const systemWebUsages = [
    ...projects
      .filter((project) => project.usesSystemWeb)
      .map((project) => `${project.path}: System.Web assembly reference`),
    ...(semanticManifest?.projects.flatMap((project) =>
      project.controllers.flatMap((controller) =>
        controller.systemWebUsages.map(
          (usage) => `${project.path}:${controller.name}: ${usage}`,
        ),
      ),
    ) ?? []),
  ];
  const windowsDependencies = projects.flatMap((project) => [
    ...(project.hasComReferences ? [`${project.path}: COM reference`] : []),
    ...(project.hasNativeDependencies
      ? [`${project.path}: native or Windows-specific assembly`]
      : []),
    ...(project.usesWindowsService
      ? [`${project.path}: Windows Service lifecycle`]
      : []),
  ]);
  const blockers = [
    ...ingestionBlockers,
    ...(!targetConfiguration
      ? ["Missing .codeshift/dotnet-target.json target configuration."]
      : []),
    ...projects
      .filter((project) => project.hasCustomBuildLogic)
      .map((project) => `${project.path} contains custom MSBuild imports or targets.`),
    ...projects
      .filter((project) => project.hasComReferences)
      .map((project) => `${project.path} contains COM references.`),
    ...(!semanticManifest &&
    projects.some(
      (project) =>
        project.usesSystemWeb ||
        project.usesEntityFramework6 ||
        project.usesWcf ||
        project.usesWindowsService,
    )
      ? [
          "A Roslyn/MSBuild semantic manifest is required before source-level .NET planning.",
        ]
      : []),
  ];
  const linuxPenalty =
    windowsDependencies.length * 15 + iisDependencies.length * 8;
  const containerPenalty =
    windowsDependencies.length * 12 +
    iisDependencies.length * 6 +
    projects.filter((project) => project.hasCustomBuildLogic).length * 10;

  return {
    solutions,
    projects,
    semanticManifest,
    targetConfiguration,
    frameworkCompatibility: projects.flatMap((project) =>
      project.targetFrameworks.map(
        (framework) =>
          `${project.path}: ${framework} -> ${
            targetConfiguration?.targetFramework ?? "target not configured"
          }`,
      ),
    ),
    nugetCompatibility: projects.flatMap((project) =>
      project.packageReferences.map(
        (dependency) =>
          `${project.path}: ${dependency.name}@${dependency.version ?? "unspecified"} requires compatibility review.`,
      ),
    ),
    windowsDependencies,
    systemWebUsages,
    iisDependencies,
    aspNetRoutes,
    efCompatibility: buildEfCompatibility(projects, semanticManifest),
    wcfRecommendations: buildWcfRecommendations(
      projects,
      semanticManifest,
      configWcf,
    ),
    linuxReadinessScore: Math.max(0, 100 - linuxPenalty),
    containerReadinessScore: Math.max(0, 100 - containerPenalty),
    blockers,
  };
}

export function parseMsBuildProject(
  path: string,
  source: string,
  packagesConfig: DotNetPackageReference[] = [],
): DotNetProjectAnalysis {
  const parsed = asRecord(parseXml(source, path));
  const project = asRecord(parsed.Project);
  if (Object.keys(project).length === 0) {
    throw new Error(`${path} is not a valid MSBuild project.`);
  }

  const propertyGroups = arrayOf(project.PropertyGroup).map(asRecord);
  const itemGroups = arrayOf(project.ItemGroup).map(asRecord);
  const targetFrameworks = firstValues(propertyGroups, [
    "TargetFramework",
    "TargetFrameworks",
    "TargetFrameworkVersion",
  ]).flatMap((value) => value.split(";").map(normalizeFramework));
  const packageReferences = itemGroups.flatMap((group) =>
    arrayOf(group.PackageReference).map((entry) => {
      const record = asRecord(entry);
      return {
        name: stringValue(record["@_Include"]),
        version:
          optionalString(record["@_Version"]) ?? optionalString(record.Version),
        source: "PackageReference" as const,
      };
    }),
  );
  const assemblyReferences = itemGroups.flatMap((group) =>
    arrayOf(group.Reference)
      .map((entry) =>
        typeof entry === "string"
          ? entry
          : stringValue(asRecord(entry)["@_Include"]),
      )
      .filter(Boolean),
  );
  const projectReferences = itemGroups.flatMap((group) =>
    arrayOf(group.ProjectReference)
      .map((entry) => stringValue(asRecord(entry)["@_Include"]))
      .filter(Boolean),
  );
  const imports = arrayOf(project.Import)
    .map((entry) => stringValue(asRecord(entry)["@_Project"]))
    .filter(Boolean);
  const comReferences = itemGroups.flatMap((group) => arrayOf(group.COMReference));
  const combinedReferences = assemblyReferences.join(" ");

  return {
    path,
    name:
      optionalString(firstValue(propertyGroups, "AssemblyName")) ??
      basenameWithoutExtension(path),
    sdkStyle: Boolean(project["@_Sdk"]),
    sdk: optionalString(project["@_Sdk"]),
    targetFrameworks,
    outputType: optionalString(firstValue(propertyGroups, "OutputType")),
    projectReferences,
    packageReferences: [...packageReferences, ...packagesConfig],
    assemblyReferences,
    imports,
    hasCustomBuildLogic:
      arrayOf(project.Target).length > 0 ||
      imports.some(
        (value) =>
          !value.includes("Microsoft.CSharp.targets") &&
          !value.includes("Microsoft.Common.props"),
      ),
    hasComReferences: comReferences.length > 0,
    hasNativeDependencies:
      /\b(?:System\.Drawing|Microsoft\.Win32|System\.Management|PInvoke|DllImport)\b/i.test(
        combinedReferences,
      ),
    usesSystemWeb: /\bSystem\.Web\b/i.test(combinedReferences),
    usesEntityFramework6:
      [...packageReferences, ...packagesConfig].some(
        (dependency) => dependency.name.toLowerCase() === "entityframework",
      ) || /\bEntityFramework\b/i.test(combinedReferences),
    usesWcf:
      /\bSystem\.ServiceModel\b/i.test(combinedReferences) ||
      [...packageReferences, ...packagesConfig].some((dependency) =>
        /corewcf|servicemodel/i.test(dependency.name),
      ),
    usesWindowsService: /\bSystem\.ServiceProcess\b/i.test(combinedReferences),
  };
}

export function parsePackagesConfig(source: string): DotNetPackageReference[] {
  const parsed = asRecord(parseXml(source, "packages.config"));
  return arrayOf(asRecord(parsed.packages).package)
    .map(asRecord)
    .map((entry) => ({
      name: stringValue(entry["@_id"]),
      version: optionalString(entry["@_version"]),
      source: "packages.config" as const,
    }))
    .filter((entry) => entry.name.length > 0);
}

export function parseSolutionProjects(source: string): string[] {
  return source
    .split(/\r?\n/)
    .map((line) =>
      line.match(
        /^Project\("[^"]+"\)\s*=\s*"[^"]+",\s*"([^"]+\.(?:cs|vb|fs)proj)"/i,
      )?.[1],
    )
    .filter((value): value is string => Boolean(value))
    .map(normalize);
}

export function readDotNetTargetConfiguration(
  files: readonly RecipeFile[],
): DotNetTargetConfiguration | undefined {
  const file = files.find(
    (entry) =>
      normalize(entry.path).toLowerCase() ===
      ".codeshift/dotnet-target.json",
  );
  if (!file?.content) return undefined;
  if (file.content.length > 64_000) {
    throw new Error(".NET target configuration exceeds the 64 KB limit.");
  }
  const value = JSON.parse(file.content) as Partial<DotNetTargetConfiguration>;
  if (
    !value.targetFramework ||
    !value.aspNetCoreTargetFramework ||
    !["linux", "windows", "none"].includes(value.containerTarget ?? "")
  ) {
    throw new Error("Invalid .codeshift/dotnet-target.json configuration.");
  }
  return {
    targetFramework: value.targetFramework,
    aspNetCoreTargetFramework: value.aspNetCoreTargetFramework,
    allowWindowsCompatibility: value.allowWindowsCompatibility === true,
    containerTarget: value.containerTarget as DotNetTargetConfiguration["containerTarget"],
  };
}

export function readDotNetSemanticManifest(
  files: readonly RecipeFile[],
): DotNetSemanticManifest | undefined {
  const file = files.find(
    (entry) =>
      normalize(entry.path).toLowerCase() ===
      ".codeshift/dotnet-semantic-manifest.json",
  );
  if (!file?.content) return undefined;
  if (file.content.length > MAX_MANIFEST_BYTES) {
    throw new Error(".NET semantic manifest exceeds the 10 MB limit.");
  }
  const value = JSON.parse(file.content) as Partial<DotNetSemanticManifest>;
  if (
    value.schemaVersion !== 1 ||
    typeof value.generatedBy !== "string" ||
    !/roslyn|msbuild/i.test(value.generatedBy) ||
    !Array.isArray(value.projects)
  ) {
    throw new Error(
      "The .NET semantic manifest must be schema v1 and generated by Roslyn/MSBuild.",
    );
  }
  return value as DotNetSemanticManifest;
}

function inspectConfiguration(path: string, source: string): {
  iisDependencies: string[];
  wcfBindings: string[];
} {
  const parsed = asRecord(parseXml(source, path));
  const configuration = asRecord(parsed.configuration);
  const systemWeb = asRecord(configuration["system.web"]);
  const systemWebServer = asRecord(configuration["system.webServer"]);
  const serviceModel = asRecord(configuration["system.serviceModel"]);
  return {
    iisDependencies: [
      ...(Object.keys(systemWeb).length > 0 ? [`${path}: system.web`] : []),
      ...(Object.keys(systemWebServer).length > 0
        ? [`${path}: system.webServer/IIS`]
        : []),
    ],
    wcfBindings: collectObjectKeys(asRecord(serviceModel.bindings)),
  };
}

function buildEfCompatibility(
  projects: readonly DotNetProjectAnalysis[],
  manifest?: DotNetSemanticManifest,
): string[] {
  return projects
    .filter((project) => project.usesEntityFramework6)
    .flatMap((project) => {
      const contexts =
        manifest?.projects.find((entry) => entry.path === project.path)?.efContexts ??
        [];
      return contexts.length > 0
        ? contexts.map(
            (context) =>
              `${project.path}:${context.name}: ${context.features.join(", ") || "basic DbContext"} requires EF Core compatibility review.`,
          )
        : [`${project.path}: EF6 detected; semantic context inventory is required.`];
    });
}

function buildWcfRecommendations(
  projects: readonly DotNetProjectAnalysis[],
  manifest: DotNetSemanticManifest | undefined,
  configBindings: readonly string[],
): string[] {
  return projects
    .filter((project) => project.usesWcf)
    .flatMap((project) => {
      const services =
        manifest?.projects.find((entry) => entry.path === project.path)?.wcfServices ??
        [];
      if (services.length === 0) {
        return [`${project.path}: retain WCF until a semantic contract inventory is available.`];
      }
      return services.map((service) => {
        if (service.hasDuplex || service.usesTransactions) {
          return `${service.contract}: assess CoreWCF for compatibility; do not auto-select a target.`;
        }
        if (service.hasStreaming) {
          return `${service.contract}: compare CoreWCF and gRPC streaming with client compatibility.`;
        }
        return `${service.contract}: compare CoreWCF, gRPC, and ASP.NET Core APIs before approval.`;
      });
    })
    .concat(
      configBindings.map(
        (binding) => `Configuration binding ${binding} requires transport/security review.`,
      ),
    );
}

function firstValues(
  groups: readonly Record<string, unknown>[],
  names: readonly string[],
): string[] {
  return names.flatMap((name) => {
    const value = firstValue(groups, name);
    return value === undefined ? [] : [stringValue(value)];
  });
}

function firstValue(
  groups: readonly Record<string, unknown>[],
  name: string,
): unknown {
  return groups.find((group) => group[name] !== undefined)?.[name];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function arrayOf(value: unknown): unknown[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function stringValue(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

function optionalString(value: unknown): string | undefined {
  const result = stringValue(value);
  return result.length > 0 ? result : undefined;
}

function normalizeFramework(value: string): string {
  const trimmed = value.trim();
  return /^v\d/i.test(trimmed)
    ? `net${trimmed.slice(1).replaceAll(".", "")}`
    : trimmed;
}

function collectObjectKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).filter((key) => !key.startsWith("@_"));
}

function normalize(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/|\/+$/g, "");
}

function directoryOf(path: string): string {
  const normalized = normalize(path);
  const separator = normalized.lastIndexOf("/");
  return separator === -1 ? "." : normalized.slice(0, separator);
}

function basenameWithoutExtension(path: string): string {
  const normalized = normalize(path);
  const name = normalized.slice(normalized.lastIndexOf("/") + 1);
  return name.replace(/\.[^.]+$/, "");
}

function parseXml(source: string, path: string): unknown {
  if (source.length > MAX_XML_BYTES) {
    throw new Error(`${path} exceeds the 5 MB XML analysis limit.`);
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) {
    throw new Error(`${path} contains prohibited XML declarations.`);
  }
  return xmlParser.parse(source);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown analysis failure.";
}
