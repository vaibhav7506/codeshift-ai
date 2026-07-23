import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { RepositoryAnalysis } from "@codeshift/shared";
import {
  analyzeDotNetRepository,
  compareDotNetRoutes,
  convertLegacyProjectToSdk,
  createDefaultRecipeRegistry,
  createDotNetValidationContract,
  parsePackagesConfig,
  readDotNetSemanticManifest,
  summarizeDotNetValidation,
  type DotNetTargetConfiguration,
} from "./index.js";
import type { RecipeFile } from "./recipe.js";

const fixtureRoot = new URL(
  "../fixtures/dotnet/legacy-enterprise/",
  import.meta.url,
);

const fixtureFiles: RecipeFile[] = [
  "LegacyEnterprise.sln",
  "src/LegacyWeb/LegacyWeb.csproj",
  "src/LegacyWeb/packages.config",
  "src/LegacyWeb/web.config",
  ".codeshift/dotnet-target.json",
  ".codeshift/dotnet-semantic-manifest.json",
].map((path) => ({
  path,
  content: readFileSync(new URL(path, fixtureRoot), "utf8"),
}));

const analysis: RepositoryAnalysis = {
  repoUrl: "file:///dotnet-fixture",
  owner: "local",
  repo: "legacy-enterprise",
  defaultBranch: "main",
  packageManager: "unknown",
  framework: "unknown",
  moduleSystem: "unknown",
  totalFiles: fixtureFiles.length,
  jsFiles: 0,
  tsFiles: 0,
  jsxFiles: 0,
  tsxFiles: 0,
  hasTsConfig: false,
  hasTests: true,
  hasBuildScript: true,
  hasLintScript: false,
  hasTypecheckScript: false,
  riskFactors: [],
  recommendedScopes: [
    {
      path: ".",
      reason: "Controlled .NET fixture",
      estimatedFiles: fixtureFiles.length,
      risk: "HIGH",
    },
  ],
  readinessScore: 38,
  difficulty: "HIGH",
};

test(".NET intelligence parses solutions, MSBuild XML, config, packages, and semantic manifests", () => {
  const report = analyzeDotNetRepository(fixtureFiles);

  assert.deepEqual(report.solutions[0].projects, [
    "src/LegacyWeb/LegacyWeb.csproj",
  ]);
  assert.equal(report.projects[0].sdkStyle, false);
  assert.deepEqual(report.projects[0].targetFrameworks, ["net472"]);
  assert.equal(
    report.projects[0].packageReferences.some(
      (dependency) =>
        dependency.name === "EntityFramework" &&
        dependency.source === "packages.config",
    ),
    true,
  );
  assert.equal(report.projects[0].usesSystemWeb, true);
  assert.equal(report.projects[0].usesEntityFramework6, true);
  assert.equal(report.projects[0].usesWcf, true);
  assert.equal(report.projects[0].usesWindowsService, true);
  assert.equal(report.aspNetRoutes[0].template, "/api/users/{id}");
  assert.equal(report.targetConfiguration?.containerTarget, "linux");
  assert.match(report.wcfRecommendations[0], /CoreWCF/);
  assert.ok(report.linuxReadinessScore < 100);
});

test(".NET semantic input rejects non-Roslyn manifests instead of parsing C# text", () => {
  assert.throws(
    () =>
      readDotNetSemanticManifest([
        {
          path: ".codeshift/dotnet-semantic-manifest.json",
          content: JSON.stringify({
            schemaVersion: 1,
            generatedBy: "text-regex-parser",
            projects: [],
          }),
        },
      ]),
    /Roslyn\/MSBuild/,
  );

  const hostile = analyzeDotNetRepository([
    {
      path: "Hostile.csproj",
      content:
        '<!DOCTYPE project [<!ENTITY xxe SYSTEM "file:///secret">]><Project>&xxe;</Project>',
    },
  ]);
  assert.equal(hostile.projects.length, 0);
  assert.match(hostile.blockers.join(" "), /prohibited XML declarations/);
});

test("controlled legacy project conversion emits SDK style and retains package compatibility evidence", () => {
  const project = fixtureFiles.find((file) => file.path.endsWith(".csproj"));
  const packages = fixtureFiles.find((file) => file.path.endsWith("packages.config"));
  const configuration: DotNetTargetConfiguration = {
    targetFramework: "net8.0",
    aspNetCoreTargetFramework: "net8.0",
    allowWindowsCompatibility: false,
    containerTarget: "linux",
  };
  const result = convertLegacyProjectToSdk(
    project?.path ?? "",
    project?.content ?? "",
    configuration,
    parsePackagesConfig(packages?.content ?? ""),
  );

  assert.match(result.code, /<Project Sdk="Microsoft\.NET\.Sdk\.Web">/);
  assert.match(result.code, /<TargetFramework>net8\.0<\/TargetFramework>/);
  assert.match(result.code, /PackageReference Include="EntityFramework"/);
  assert.match(result.code, /ProjectReference Include="\.\.\\LegacyDomain/);
  assert.match(result.warnings?.join(" ") ?? "", /packages\.config was retained/);

  const comProject =
    '<Project ToolsVersion="15.0"><PropertyGroup><TargetFrameworkVersion>v4.8</TargetFrameworkVersion></PropertyGroup><ItemGroup><COMReference Include="Legacy" /></ItemGroup></Project>';
  assert.equal(
    convertLegacyProjectToSdk(
      "Legacy.csproj",
      comProject,
      configuration,
    ).code,
    comProject,
  );
});

test("all Phase 3 recipes implement the contract and keep assessment-only sources unchanged", async () => {
  const registry = createDefaultRecipeRegistry();
  const phase3Ids = [
    "dotnet-framework-modernization",
    "aspnet-to-aspnet-core",
    "ef6-to-ef-core",
    "wcf-modernization",
    "windows-service-to-worker",
  ];

  for (const id of phase3Ids) {
    const recipe = registry.get(id);
    const repositoryContext = {
      repositoryId: "dotnet-fixture",
      analysis,
      files: fixtureFiles,
    };
    assert.equal((await recipe.detect(repositoryContext)).detected, true);
    assert.ok((await recipe.assess(repositoryContext)).score >= 0);
    const plan = await recipe.plan({
      ...repositoryContext,
      approvedScope: ".",
    });
    const result = await recipe.transform({
      ...repositoryContext,
      approvedScope: ".",
      rootPath: ".",
      plan,
    });
    assert.ok(result.changedFiles.length > 0);
    if (id === "dotnet-framework-modernization") {
      assert.equal(
        result.changedFiles.includes(
          ".codeshift/dotnet-modernization-report.json",
        ),
        true,
      );
    }
    assert.equal(
      (
        await recipe.validate({
          ...repositoryContext,
          plan,
          results: [{ command: "fixture-validation", status: "PASSED", logs: "" }],
        })
      ).passed,
      true,
    );
    assert.equal(
      (
        await recipe.rollback({
          ...repositoryContext,
          checkpointId: "checkpoint-dotnet",
          approvedBy: "reviewer",
        })
      ).requiresApproval,
      true,
    );
  }

  const efRecipe = registry.get("ef6-to-ef-core");
  const efPlan = await efRecipe.plan({
    repositoryId: "dotnet-fixture",
    analysis,
    files: fixtureFiles,
    approvedScope: ".",
  });
  const efResult = await efRecipe.transform({
    repositoryId: "dotnet-fixture",
    analysis,
    files: fixtureFiles,
    approvedScope: ".",
    rootPath: ".",
    plan: efPlan,
  });
  assert.equal(
    efResult.fileChanges?.some(
      (change) =>
        change.path === ".codeshift/ef-core-compatibility.json" &&
        change.originalCode === "",
    ),
    true,
  );
});

test(".NET validation contracts require native evidence and compare route authorization", () => {
  const report = analyzeDotNetRepository(fixtureFiles);
  const contract = createDotNetValidationContract(report);
  assert.equal(
    contract.find((entry) => entry.command === "docker build .")?.required,
    true,
  );
  const unavailable = summarizeDotNetValidation(contract, [
    {
      command: "dotnet restore",
      status: "SKIPPED",
      logs: "SDK unavailable",
    },
  ]);
  assert.equal(unavailable.passed, false);
  assert.ok(unavailable.missingRequired.length > 0);

  const route = report.aspNetRoutes[0];
  const parity = compareDotNetRoutes(
    [route],
    [{ ...route, authorization: [] }],
  );
  assert.equal(parity.passed, false);
  assert.equal(parity.differences[0].field, "authorization");
});
