import type { MigrationTarget } from "@codeshift/shared";
import {
  createDeterministicRecipe,
  type FileTransformResult,
} from "./deterministic-recipe.js";
import {
  analyzeDotNetRepository,
  parseMsBuildProject,
  type DotNetRepositoryReport,
  type DotNetSemanticManifest,
  type DotNetTargetConfiguration,
} from "./dotnet-intelligence.js";
import { modernizationMetadata } from "./modernization-metadata.js";
import type { RecipeFile, RepositoryContext } from "./recipe.js";

export const DOTNET_FRAMEWORK_METADATA = modernizationMetadata({
  id: "dotnet-framework-modernization",
  name: ".NET Framework to modern .NET",
  description:
    "Converts controlled legacy MSBuild projects to SDK style using an explicit target configuration and produces compatibility evidence.",
  sourceTechnology: ".NET Framework and legacy MSBuild",
  targetTechnology: "configured modern .NET target",
  sourceVersions: [".NET Framework 4.x", "legacy MSBuild project format"],
  targetVersions: ["configured in .codeshift/dotnet-target.json"],
  requiredTools: ["Node.js 20+", ".NET SDK matching the configured target"],
  filesItMayModify: [
    "<approved-scope>/**/*.{csproj,vbproj,fsproj}",
    "<approved-scope>/**/packages.config",
    ".codeshift/dotnet-modernization-report.json",
  ],
  knownLimitations: [
    "Projects with COM references, custom targets, or non-framework assembly references remain unchanged.",
    "packages.config is retained until restore and package compatibility validation pass.",
    "Source-level compatibility requires a Roslyn/MSBuild semantic manifest.",
  ],
  riskFactors: [
    "Target framework change",
    "Package compatibility",
    "Custom MSBuild logic",
    "Windows-only APIs",
    "Native and COM dependencies",
  ],
  validationRequirements: [
    "dotnet restore",
    "dotnet build --no-restore",
    "dotnet test --no-build",
    "dotnet list package --vulnerable",
    "API compatibility analysis",
    "container build when configured",
  ],
});

export const ASPNET_CORE_METADATA = modernizationMetadata({
  id: "aspnet-to-aspnet-core",
  name: "ASP.NET MVC/Web API to ASP.NET Core",
  description:
    "Builds an approval-gated ASP.NET Core migration scaffold and route compatibility report from Roslyn semantic data.",
  sourceTechnology: "ASP.NET MVC and ASP.NET Web API",
  targetTechnology: "ASP.NET Core",
  sourceVersions: ["ASP.NET MVC 5", "ASP.NET Web API 2"],
  targetVersions: ["configured in .codeshift/dotnet-target.json"],
  requiredTools: ["Node.js 20+", "Roslyn/MSBuild analyzer", ".NET SDK"],
  filesItMayModify: [
    "migration/aspnet-core/Program.cs",
    "migration/aspnet-core/appsettings.json",
    ".codeshift/aspnet-core-compatibility.json",
  ],
  dependencies: ["dotnet-framework-modernization"],
  knownLimitations: [
    "Controller source is not rewritten without semantic transformation support.",
    "System.Web, session, authentication, filters, and custom model binders require explicit review.",
    "The generated scaffold is additive and does not replace the existing application.",
  ],
  riskFactors: [
    "System.Web usage",
    "Authentication and authorization",
    "Route and filter ordering",
    "Session state",
    "IIS configuration",
  ],
  validationRequirements: [
    "dotnet restore",
    "dotnet build",
    "dotnet test",
    "route-parity",
    "authentication-parity",
    "error-behaviour-parity",
  ],
});

export const EF6_TO_EF_CORE_METADATA = modernizationMetadata({
  id: "ef6-to-ef-core",
  name: "Entity Framework 6 to EF Core",
  description:
    "Produces an assessment-first EF compatibility report without changing application code or databases.",
  sourceTechnology: "Entity Framework 6",
  targetTechnology: "Entity Framework Core",
  sourceVersions: ["Entity Framework 6.x"],
  targetVersions: ["compatible EF Core version for configured .NET target"],
  requiredTools: ["Node.js 20+", "Roslyn/MSBuild analyzer", ".NET SDK"],
  filesItMayModify: [".codeshift/ef-core-compatibility.json"],
  dependencies: ["dotnet-framework-modernization"],
  knownLimitations: [
    "No DbContext, migration, or production database is modified automatically.",
    "Stored procedures, raw SQL, lazy loading, provider behaviour, and transactions require integration tests.",
  ],
  riskFactors: [
    "Database provider",
    "Migration history",
    "Stored procedures and raw SQL",
    "Lazy loading",
    "Transaction behaviour",
  ],
  validationRequirements: [
    "dotnet build",
    "dotnet test",
    "database integration tests",
    "migration script review",
    "provider compatibility",
  ],
});

export const WCF_MODERNIZATION_METADATA = modernizationMetadata({
  id: "wcf-modernization",
  name: "WCF modernization assessment",
  description:
    "Compares CoreWCF, gRPC, ASP.NET Core APIs, and retaining WCF without automatically selecting a target.",
  sourceTechnology: "Windows Communication Foundation",
  targetTechnology: "CoreWCF, gRPC, ASP.NET Core API, or retained WCF",
  sourceVersions: ["WCF on .NET Framework"],
  targetVersions: ["assessment-selected target"],
  requiredTools: ["Node.js 20+", "Roslyn/MSBuild analyzer"],
  filesItMayModify: [".codeshift/wcf-modernization-report.json"],
  dependencies: ["dotnet-framework-modernization"],
  knownLimitations: [
    "No service or client contract is rewritten automatically.",
    "Duplex, transactions, streaming, serialization, binding security, and client compatibility require human target selection.",
  ],
  riskFactors: [
    "Client compatibility",
    "Bindings and security",
    "Transactions",
    "Duplex communication",
    "Streaming and serialization",
  ],
  validationRequirements: [
    "contract inventory",
    "client compatibility",
    "serialization parity",
    "transport security review",
  ],
});

export const WINDOWS_SERVICE_METADATA = modernizationMetadata({
  id: "windows-service-to-worker",
  name: "Windows Service to Worker Service",
  description:
    "Generates an additive Worker Service scaffold from a Roslyn service lifecycle inventory.",
  sourceTechnology: "Windows Service",
  targetTechnology: ".NET Worker Service",
  sourceVersions: [".NET Framework Windows Service"],
  targetVersions: ["configured in .codeshift/dotnet-target.json"],
  requiredTools: ["Node.js 20+", "Roslyn/MSBuild analyzer", ".NET SDK"],
  filesItMayModify: [
    "migration/worker-service/Program.cs",
    "migration/worker-service/Worker.cs",
    ".codeshift/worker-service-report.json",
  ],
  dependencies: ["dotnet-framework-modernization"],
  knownLimitations: [
    "Service-specific lifecycle bodies are not copied without semantic transformation support.",
    "The original Windows Service remains intact until validation and approval.",
  ],
  riskFactors: [
    "Service lifecycle",
    "Graceful shutdown",
    "Windows-only APIs",
    "Configuration and credentials",
    "Container readiness",
  ],
  validationRequirements: [
    "dotnet restore",
    "dotnet build",
    "dotnet test",
    "graceful-shutdown test",
    "container build when configured",
  ],
});

export const dotNetFrameworkRecipe = createDotNetRecipe({
  metadata: DOTNET_FRAMEWORK_METADATA,
  target: "DOTNET_FRAMEWORK_TO_MODERN",
  detection(report) {
    return report.projects.some(
      (project) => !project.sdkStyle || project.targetFrameworks.some(isFrameworkTarget),
    );
  },
  transform(file, context, report) {
    if (!/\.(?:cs|vb|fs)proj$/i.test(file.path) || !file.content) return undefined;
    const configuration = report.targetConfiguration;
    if (!configuration) {
      return preserved(
        file.content,
        "The configured modern .NET target is missing.",
        "HIGH",
      );
    }
    const analyzed = report.projects.find((project) => project.path === file.path);
    const result = convertLegacyProjectToSdk(
      file.path,
      file.content,
      configuration,
      analyzed?.packageReferences.filter(
        (dependency) => dependency.source === "packages.config",
      ),
    );
    const firstProject = report.projects.map((project) => project.path).sort()[0];
    if (file.path === firstProject) {
      result.additionalChanges = [
        ...(result.additionalChanges ?? []),
        {
          path: ".codeshift/dotnet-modernization-report.json",
          code: `${JSON.stringify(
            {
              targetConfiguration: report.targetConfiguration,
              frameworkCompatibility: report.frameworkCompatibility,
              nugetCompatibility: report.nugetCompatibility,
              windowsDependencies: report.windowsDependencies,
              systemWebUsages: report.systemWebUsages,
              iisDependencies: report.iisDependencies,
              linuxReadinessScore: report.linuxReadinessScore,
              containerReadinessScore: report.containerReadinessScore,
              blockers: report.blockers,
            },
            null,
            2,
          )}\n`,
          reason: "Generated the staged .NET compatibility and readiness report.",
        },
      ];
    }
    return result;
  },
});

export const aspNetCoreRecipe = createDotNetRecipe({
  metadata: ASPNET_CORE_METADATA,
  target: "ASPNET_TO_ASPNET_CORE",
  detection(report) {
    return (
      report.systemWebUsages.length > 0 ||
      report.aspNetRoutes.length > 0 ||
      report.iisDependencies.length > 0
    );
  },
  transform(file, context, report) {
    if (
      normalize(file.path) !== ".codeshift/dotnet-semantic-manifest.json" ||
      !file.content
    ) {
      return undefined;
    }
    if (!report.semanticManifest || !report.targetConfiguration) {
      return preserved(
        file.content,
        "ASP.NET Core planning requires both semantic and target manifests.",
        "HIGH",
      );
    }
    return generateAspNetCoreScaffold(
      file.content,
      report.semanticManifest,
      report,
    );
  },
});

export const ef6ToEfCoreRecipe = createAssessmentRecipe({
  metadata: EF6_TO_EF_CORE_METADATA,
  target: "EF6_TO_EF_CORE",
  artifactPath: ".codeshift/ef-core-compatibility.json",
  detection(report) {
    return report.projects.some((project) => project.usesEntityFramework6);
  },
  buildReport(report) {
    return {
      assessmentOnly: true,
      databaseModified: false,
      contexts:
        report.semanticManifest?.projects.flatMap((project) =>
          project.efContexts.map((context) => ({
            project: project.path,
            ...context,
          })),
        ) ?? [],
      compatibility: report.efCompatibility,
      requiredEvidence: EF6_TO_EF_CORE_METADATA.validationRequirements,
      decision: "Human approval required before code or database changes.",
    };
  },
});

export const wcfModernizationRecipe = createAssessmentRecipe({
  metadata: WCF_MODERNIZATION_METADATA,
  target: "WCF_MODERNIZATION",
  artifactPath: ".codeshift/wcf-modernization-report.json",
  detection(report) {
    return report.projects.some((project) => project.usesWcf);
  },
  buildReport(report) {
    return {
      assessmentOnly: true,
      targetSelected: false,
      services:
        report.semanticManifest?.projects.flatMap((project) =>
          project.wcfServices.map((service) => ({
            project: project.path,
            ...service,
          })),
        ) ?? [],
      recommendations: report.wcfRecommendations,
      candidates: ["CoreWCF", "gRPC", "ASP.NET Core API", "Retain WCF"],
      decision: "A reviewer must select a target after client compatibility analysis.",
    };
  },
});

export const windowsServiceToWorkerRecipe = createDotNetRecipe({
  metadata: WINDOWS_SERVICE_METADATA,
  target: "WINDOWS_SERVICE_TO_WORKER",
  detection(report) {
    return report.projects.some((project) => project.usesWindowsService);
  },
  transform(file, context, report) {
    if (
      normalize(file.path) !== ".codeshift/dotnet-semantic-manifest.json" ||
      !file.content
    ) {
      return undefined;
    }
    const services =
      report.semanticManifest?.projects.flatMap((project) =>
        project.windowsServices.map((service) => ({
          project: project.path,
          ...service,
        })),
      ) ?? [];
    if (services.length === 0 || !report.targetConfiguration) {
      return preserved(
        file.content,
        "Worker conversion requires a semantic service inventory and target configuration.",
        "HIGH",
      );
    }
    return generateWorkerScaffold(file.content, services, report);
  },
});

export function convertLegacyProjectToSdk(
  path: string,
  source: string,
  configuration: DotNetTargetConfiguration,
  packagesConfig = [] as DotNetProjectPackages,
): FileTransformResult {
  const project = parseMsBuildProject(path, source, packagesConfig);
  if (project.sdkStyle) {
    return {
      code: source,
      reason: "The project is already SDK style.",
      confidence: 1,
      risk: "LOW",
    };
  }
  const unsupportedReferences = project.assemblyReferences.filter(
    (reference) =>
      !/^(?:System(?:\.|$)|Microsoft\.CSharp$|netstandard$|WindowsBase$)/i.test(reference) &&
      !project.packageReferences.some(
        (dependency) =>
          reference.split(",")[0].toLowerCase() === dependency.name.toLowerCase(),
      ),
  );
  if (
    project.hasCustomBuildLogic ||
    project.hasComReferences ||
    unsupportedReferences.length > 0
  ) {
    return preserved(
      source,
      "Custom build logic, COM, or non-framework assembly references prevent safe SDK conversion.",
      "CRITICAL",
      [
        ...project.imports,
        ...unsupportedReferences,
        ...(project.hasComReferences ? ["COMReference"] : []),
      ],
    );
  }

  const sdk = project.usesSystemWeb
    ? "Microsoft.NET.Sdk.Web"
    : "Microsoft.NET.Sdk";
  const packageLines = project.packageReferences
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(
      (dependency) =>
        `    <PackageReference Include="${escapeXml(dependency.name)}"${
          dependency.version
            ? ` Version="${escapeXml(dependency.version)}"`
            : ""
        } />`,
    );
  const projectReferenceLines = project.projectReferences.map(
    (reference) =>
      `    <ProjectReference Include="${escapeXml(reference)}" />`,
  );
  const code = [
    `<Project Sdk="${sdk}">`,
    "  <PropertyGroup>",
    `    <TargetFramework>${escapeXml(configuration.targetFramework)}</TargetFramework>`,
    ...(project.outputType
      ? [`    <OutputType>${escapeXml(project.outputType)}</OutputType>`]
      : []),
    `    <AssemblyName>${escapeXml(project.name)}</AssemblyName>`,
    "    <Nullable>enable</Nullable>",
    "    <ImplicitUsings>enable</ImplicitUsings>",
    ...(configuration.allowWindowsCompatibility
      ? ["    <EnableWindowsTargeting>true</EnableWindowsTargeting>"]
      : []),
    "  </PropertyGroup>",
    ...(packageLines.length > 0
      ? ["  <ItemGroup>", ...packageLines, "  </ItemGroup>"]
      : []),
    ...(projectReferenceLines.length > 0
      ? ["  <ItemGroup>", ...projectReferenceLines, "  </ItemGroup>"]
      : []),
    "</Project>",
    "",
  ].join("\n");

  return {
    code,
    reason: `Converted the controlled legacy project to ${sdk} targeting ${configuration.targetFramework}.`,
    confidence: 0.88,
    risk: "HIGH",
    warnings: project.packageReferences.some(
      (dependency) => dependency.source === "packages.config",
    )
      ? ["packages.config was retained until restore and compatibility validation pass."]
      : [],
    behaviourPotentiallyAffected: [
      "Assembly binding",
      "Package resolution",
      "Build item inclusion",
      "Runtime target",
    ],
    unsupportedAssumptions: [
      "Implicit SDK compile-item inclusion matches the legacy project.",
      "Package versions support the configured target.",
    ],
  };
}

type DotNetProjectPackages = Parameters<typeof parseMsBuildProject>[2];

function createDotNetRecipe(input: {
  metadata: typeof DOTNET_FRAMEWORK_METADATA;
  target: MigrationTarget;
  detection(report: DotNetRepositoryReport): boolean;
  transform(
    file: RecipeFile,
    context: RepositoryContext,
    report: DotNetRepositoryReport,
  ): FileTransformResult | undefined;
}) {
  const reports = new WeakMap<RepositoryContext, DotNetRepositoryReport>();
  const reportFor = (context: RepositoryContext) => {
    const cached = reports.get(context);
    if (cached) return cached;
    const report = analyzeDotNetRepository(context.files);
    reports.set(context, report);
    return report;
  };
  return createDeterministicRecipe({
    metadata: input.metadata,
    target: input.target,
    matches: (file) =>
      /\.(?:sln|csproj|vbproj|fsproj|config)$/i.test(file.path) ||
      normalize(file.path).startsWith(".codeshift/"),
    detect(context) {
      const report = reportFor(context);
      const detected = input.detection(report);
      return {
        detected,
        confidence: detected ? (report.semanticManifest ? 0.98 : 0.82) : 0,
        evidence: [
          ...report.projects.map(
            (project) =>
              `${project.path}: ${project.sdkStyle ? "SDK-style" : "legacy"} ${project.targetFrameworks.join(", ") || "unknown target"}.`,
          ),
          ...report.blockers,
        ],
      };
    },
    assess(context) {
      const report = reportFor(context);
      const score = Math.min(
        100,
        30 +
          report.blockers.length * 15 +
          report.windowsDependencies.length * 10 +
          report.systemWebUsages.length * 5,
      );
      return {
        level:
          score >= 85
            ? "CRITICAL"
            : score >= 65
              ? "HIGH"
              : score >= 35
                ? "MEDIUM"
                : "LOW",
        score,
        factors: [
          ...report.blockers,
          ...report.windowsDependencies,
          ...report.systemWebUsages,
        ],
      };
    },
    transformFile(file, context) {
      return input.transform(file, context, reportFor(context));
    },
  });
}

function createAssessmentRecipe(input: {
  metadata: typeof EF6_TO_EF_CORE_METADATA;
  target: MigrationTarget;
  artifactPath: string;
  detection(report: DotNetRepositoryReport): boolean;
  buildReport(report: DotNetRepositoryReport): unknown;
}) {
  return createDotNetRecipe({
    metadata: input.metadata,
    target: input.target,
    detection: input.detection,
    transform(file, context, report) {
      const anchor = context.files
        .filter((candidate) => /\.(?:cs|vb|fs)proj$/i.test(candidate.path))
        .map((candidate) => candidate.path)
        .sort()[0];
      if (file.path !== anchor || !file.content) return undefined;
      return {
        code: file.content,
        reason: "Assessment-only recipe; project and database code remain unchanged.",
        confidence: report.semanticManifest ? 0.98 : 0.7,
        risk: "HIGH",
        unsupportedAssumptions: report.blockers,
        additionalChanges: [
          {
            path: input.artifactPath,
            code: `${JSON.stringify(input.buildReport(report), null, 2)}\n`,
            reason: "Generated an approval-gated compatibility report.",
          },
        ],
      };
    },
  });
}

function generateAspNetCoreScaffold(
  source: string,
  manifest: DotNetSemanticManifest,
  report: DotNetRepositoryReport,
): FileTransformResult {
  const routes = manifest.projects.flatMap((project) =>
    project.controllers.flatMap((controller) => controller.routes),
  );
  const program = [
    "var builder = WebApplication.CreateBuilder(args);",
    "builder.Services.AddControllers();",
    "",
    "var app = builder.Build();",
    "app.UseExceptionHandler(\"/error\");",
    "app.UseAuthentication();",
    "app.UseAuthorization();",
    "app.MapControllers();",
    "app.Run();",
    "",
  ].join("\n");
  const compatibility = {
    assessmentOnly: true,
    routes,
    systemWebUsages: report.systemWebUsages,
    iisDependencies: report.iisDependencies,
    requiredEvidence: ASPNET_CORE_METADATA.validationRequirements,
    unsupported: report.blockers,
  };
  return {
    code: source,
    reason: "Preserved the semantic manifest while generating an additive ASP.NET Core scaffold.",
    confidence: 0.8,
    risk: "HIGH",
    behaviourPotentiallyAffected: [
      "Routing",
      "Authentication",
      "Filters and middleware order",
      "Error handling",
    ],
    unsupportedAssumptions: report.blockers,
    additionalChanges: [
      {
        path: "migration/aspnet-core/Program.cs",
        code: program,
        reason: "Generated an additive ASP.NET Core host scaffold for review.",
      },
      {
        path: "migration/aspnet-core/appsettings.json",
        code: `${JSON.stringify({ Logging: { LogLevel: { Default: "Information" } } }, null, 2)}\n`,
        reason: "Generated a non-secret configuration baseline.",
      },
      {
        path: ".codeshift/aspnet-core-compatibility.json",
        code: `${JSON.stringify(compatibility, null, 2)}\n`,
        reason: "Recorded route, System.Web, IIS, and validation requirements.",
      },
    ],
  };
}

function generateWorkerScaffold(
  source: string,
  services: Array<{
    project: string;
    name: string;
    lifecycleMethods: string[];
  }>,
  report: DotNetRepositoryReport,
): FileTransformResult {
  const program = [
    "var builder = Host.CreateApplicationBuilder(args);",
    "builder.Services.AddHostedService<Worker>();",
    "var host = builder.Build();",
    "await host.RunAsync();",
    "",
  ].join("\n");
  const worker = [
    "public sealed class Worker(ILogger<Worker> logger) : BackgroundService",
    "{",
    "    protected override async Task ExecuteAsync(CancellationToken stoppingToken)",
    "    {",
    "        logger.LogInformation(\"Worker started\");",
    "        await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken);",
    "    }",
    "",
    "    public override Task StopAsync(CancellationToken cancellationToken)",
    "    {",
    "        logger.LogInformation(\"Worker stopping\");",
    "        return base.StopAsync(cancellationToken);",
    "    }",
    "}",
    "",
  ].join("\n");
  return {
    code: source,
    reason: "Preserved the Windows Service while generating an additive Worker Service scaffold.",
    confidence: 0.78,
    risk: "HIGH",
    behaviourPotentiallyAffected: [
      "Service startup and shutdown",
      "Long-running work scheduling",
      "Configuration and logging",
    ],
    unsupportedAssumptions: [
      "Existing service lifecycle bodies require semantic, human-reviewed porting.",
    ],
    additionalChanges: [
      {
        path: "migration/worker-service/Program.cs",
        code: program,
        reason: "Generated the generic host entry point.",
      },
      {
        path: "migration/worker-service/Worker.cs",
        code: worker,
        reason: "Generated a cancellation-aware Worker Service boundary.",
      },
      {
        path: ".codeshift/worker-service-report.json",
        code: `${JSON.stringify(
          {
            services,
            containerTarget: report.targetConfiguration?.containerTarget,
            windowsDependencies: report.windowsDependencies,
            requiredEvidence: WINDOWS_SERVICE_METADATA.validationRequirements,
          },
          null,
          2,
        )}\n`,
        reason: "Recorded lifecycle and container-readiness review requirements.",
      },
    ],
  };
}

function preserved(
  source: string,
  reason: string,
  risk: "HIGH" | "CRITICAL",
  details: string[] = [],
): FileTransformResult {
  return {
    code: source,
    warnings: [reason],
    reason,
    confidence: 1,
    risk,
    unsupportedAssumptions: details.length > 0 ? details : [reason],
  };
}

function isFrameworkTarget(value: string): boolean {
  return /^net(?:1|2|3|4)\d*/i.test(value);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalize(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/|\/+$/g, "");
}
