using System.Text.Json;
using Microsoft.Build.Locator;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.MSBuild;

if (args.Length is < 1 or > 2)
{
    Console.Error.WriteLine(
        "Usage: dotnet run --project tools/dotnet-analyzer -- <solution.sln> [output.json]");
    return 2;
}

var solutionPath = Path.GetFullPath(args[0]);
var outputPath = Path.GetFullPath(
    args.Length == 2
        ? args[1]
        : Path.Combine(
            Path.GetDirectoryName(solutionPath)!,
            ".codeshift",
            "dotnet-semantic-manifest.json"));

MSBuildLocator.RegisterDefaults();
using var workspace = MSBuildWorkspace.Create();
var workspaceDiagnostics = new List<string>();
workspace.WorkspaceFailed += (_, eventArgs) =>
{
    var diagnostic =
        $"{eventArgs.Diagnostic.Kind}: {eventArgs.Diagnostic.Message}";
    workspaceDiagnostics.Add(diagnostic);
    Console.Error.WriteLine($"MSBuild diagnostic: {eventArgs.Diagnostic.Kind}");
};

var solution = await workspace.OpenSolutionAsync(solutionPath);
var projectReports = new List<object>();

foreach (var project in solution.Projects.Where(
             project => project.Language == LanguageNames.CSharp))
{
    var compilation = await project.GetCompilationAsync();
    if (compilation is null)
    {
        Console.Error.WriteLine($"Compilation unavailable for {project.Name}.");
        continue;
    }

    var types = EnumerateTypes(compilation.Assembly.GlobalNamespace).ToArray();
    var controllers = types
        .Where(IsController)
        .Select(type => new
        {
            name = type.Name,
            baseType = type.BaseType?.ToDisplayString() ?? "",
            routes = BuildRoutes(type),
            filters = AttributeNames(type),
            systemWebUsages = Array.Empty<string>(),
        })
        .ToList();
    var systemWebByController = await CollectSystemWebUsages(project, controllers
        .Select(controller => controller.name)
        .ToHashSet(StringComparer.Ordinal));
    controllers = controllers
        .Select(controller => new
        {
            controller.name,
            controller.baseType,
            controller.routes,
            controller.filters,
            systemWebUsages = systemWebByController.GetValueOrDefault(
                controller.name,
                Array.Empty<string>()),
        })
        .ToList();

    var efContexts = types
        .Where(type => Inherits(type, "System.Data.Entity.DbContext"))
        .Select(type => new
        {
            name = type.Name,
            provider = (string?)null,
            features = type.GetMembers()
                .OfType<IPropertySymbol>()
                .Any(property =>
                    property.Type.OriginalDefinition.ToDisplayString() ==
                    "System.Data.Entity.DbSet<TEntity>")
                ? new[] { "DbSet mapping" }
                : Array.Empty<string>(),
            entities = type.GetMembers()
                .OfType<IPropertySymbol>()
                .Where(property =>
                    property.Type is INamedTypeSymbol named &&
                    named.OriginalDefinition.ToDisplayString() ==
                    "System.Data.Entity.DbSet<TEntity>")
                .Select(property =>
                    ((INamedTypeSymbol)property.Type).TypeArguments[0].Name)
                .Distinct(StringComparer.Ordinal)
                .Order()
                .ToArray(),
        })
        .ToArray();
    var wcfServices = types
        .Where(type => HasAttribute(type, "ServiceContractAttribute"))
        .Select(type =>
        {
            var operations = type.GetMembers()
                .OfType<IMethodSymbol>()
                .Where(method => HasAttribute(method, "OperationContractAttribute"))
                .ToArray();
            return new
            {
                contract = type.ToDisplayString(),
                operations = operations.Select(method => method.Name).Order().ToArray(),
                bindings = Array.Empty<string>(),
                hasDuplex = Attribute(type, "ServiceContractAttribute")?
                    .NamedArguments.Any(argument =>
                        argument.Key == "CallbackContract" &&
                        !argument.Value.IsNull) == true,
                hasStreaming = operations.Any(UsesStream),
                usesTransactions = operations.Any(method =>
                    Attribute(method, "OperationBehaviorAttribute")?
                        .NamedArguments.Any(argument =>
                            argument.Key == "TransactionScopeRequired" &&
                            argument.Value.Value is true) == true),
            };
        })
        .ToArray();
    var windowsServices = types
        .Where(type => Inherits(type, "System.ServiceProcess.ServiceBase"))
        .Select(type => new
        {
            name = type.Name,
            lifecycleMethods = type.GetMembers()
                .OfType<IMethodSymbol>()
                .Where(method => method.Name is
                    "OnStart" or "OnStop" or "OnPause" or "OnContinue" or "OnShutdown")
                .Select(method => method.Name)
                .Distinct(StringComparer.Ordinal)
                .Order()
                .ToArray(),
        })
        .ToArray();

    projectReports.Add(new
    {
        path = RelativePath(solutionPath, project.FilePath),
        controllers,
        efContexts,
        wcfServices,
        windowsServices,
    });
}

var manifest = new
{
    schemaVersion = 1,
    generatedBy = "CodeShift Roslyn/MSBuild Analyzer 1.0",
    projects = projectReports,
    diagnostics = workspaceDiagnostics,
};
Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);
await File.WriteAllTextAsync(
    outputPath,
    JsonSerializer.Serialize(
        manifest,
        new JsonSerializerOptions { WriteIndented = true }));
Console.WriteLine($"Wrote semantic metadata for {projectReports.Count} project(s).");
return workspaceDiagnostics.Any(diagnostic =>
    diagnostic.StartsWith("Failure:", StringComparison.Ordinal)) ? 1 : 0;

static IEnumerable<INamedTypeSymbol> EnumerateTypes(INamespaceSymbol root)
{
    foreach (var type in root.GetTypeMembers())
    {
        yield return type;
        foreach (var nested in EnumerateNestedTypes(type))
            yield return nested;
    }
    foreach (var child in root.GetNamespaceMembers())
        foreach (var type in EnumerateTypes(child))
            yield return type;
}

static IEnumerable<INamedTypeSymbol> EnumerateNestedTypes(INamedTypeSymbol root)
{
    foreach (var type in root.GetTypeMembers())
    {
        yield return type;
        foreach (var nested in EnumerateNestedTypes(type))
            yield return nested;
    }
}

static bool IsController(INamedTypeSymbol type) =>
    Inherits(type, "System.Web.Mvc.Controller") ||
    Inherits(type, "System.Web.Http.ApiController") ||
    Inherits(type, "Microsoft.AspNetCore.Mvc.ControllerBase");

static bool Inherits(INamedTypeSymbol type, string metadataName)
{
    for (var current = type.BaseType; current is not null; current = current.BaseType)
        if (current.ToDisplayString() == metadataName)
            return true;
    return false;
}

static object[] BuildRoutes(INamedTypeSymbol controller)
{
    var prefix = AttributeString(controller, "RoutePrefixAttribute") ??
                 AttributeString(controller, "RouteAttribute") ?? "";
    return controller.GetMembers()
        .OfType<IMethodSymbol>()
        .Where(method =>
            method.MethodKind == MethodKind.Ordinary &&
            method.DeclaredAccessibility == Accessibility.Public &&
            !method.IsStatic)
        .Select(method => new
        {
            method = HttpMethod(method),
            template = CombineRoute(
                prefix,
                AttributeString(method, "RouteAttribute") ?? method.Name),
            controller = controller.Name,
            action = method.Name,
            authorization = AttributeNames(controller)
                .Concat(AttributeNames(method))
                .Where(name => name is "Authorize" or "AllowAnonymous")
                .Distinct(StringComparer.Ordinal)
                .Order()
                .ToArray(),
        })
        .Cast<object>()
        .ToArray();
}

static string HttpMethod(IMethodSymbol method)
{
    var names = AttributeNames(method);
    if (names.Contains("HttpGet")) return "GET";
    if (names.Contains("HttpPost")) return "POST";
    if (names.Contains("HttpPut")) return "PUT";
    if (names.Contains("HttpDelete")) return "DELETE";
    if (names.Contains("HttpPatch")) return "PATCH";
    return "ANY";
}

static string[] AttributeNames(ISymbol symbol) => symbol.GetAttributes()
    .Select(attribute =>
        attribute.AttributeClass?.Name.Replace("Attribute", "", StringComparison.Ordinal))
    .Where(name => !string.IsNullOrWhiteSpace(name))
    .Cast<string>()
    .Distinct(StringComparer.Ordinal)
    .Order()
    .ToArray();

static bool HasAttribute(ISymbol symbol, string name) =>
    Attribute(symbol, name) is not null;

static AttributeData? Attribute(ISymbol symbol, string name) =>
    symbol.GetAttributes().FirstOrDefault(attribute =>
        attribute.AttributeClass?.Name == name ||
        attribute.AttributeClass?.Name == name.Replace("Attribute", "", StringComparison.Ordinal));

static string? AttributeString(ISymbol symbol, string name) =>
    Attribute(symbol, name)?.ConstructorArguments.FirstOrDefault().Value as string;

static bool UsesStream(IMethodSymbol method) =>
    method.ReturnType.ToDisplayString() == "System.IO.Stream" ||
    method.Parameters.Any(parameter =>
        parameter.Type.ToDisplayString() == "System.IO.Stream");

static string CombineRoute(string prefix, string route) =>
    $"/{prefix.Trim('/')}/{route.Trim('/')}".Replace("//", "/", StringComparison.Ordinal);

static string RelativePath(string solutionPath, string? projectPath) =>
    projectPath is null
        ? ""
        : Path.GetRelativePath(Path.GetDirectoryName(solutionPath)!, projectPath)
            .Replace('\\', '/');

static async Task<Dictionary<string, string[]>> CollectSystemWebUsages(
    Project project,
    HashSet<string> controllerNames)
{
    var values = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
    foreach (var document in project.Documents)
    {
        var root = await document.GetSyntaxRootAsync();
        var model = await document.GetSemanticModelAsync();
        if (root is null || model is null) continue;
        foreach (var classNode in root.DescendantNodes().OfType<ClassDeclarationSyntax>()
                     .Where(node => controllerNames.Contains(node.Identifier.ValueText)))
        {
            var symbols = classNode.DescendantNodes()
                .OfType<IdentifierNameSyntax>()
                .Select(node => model.GetSymbolInfo(node).Symbol)
                .Where(symbol =>
                    symbol?.ContainingNamespace?.ToDisplayString()
                        .StartsWith("System.Web", StringComparison.Ordinal) == true)
                .Select(symbol => symbol!.ToDisplayString())
                .Distinct(StringComparer.Ordinal)
                .Take(200);
            if (!values.TryGetValue(classNode.Identifier.ValueText, out var bucket))
            {
                bucket = new HashSet<string>(StringComparer.Ordinal);
                values[classNode.Identifier.ValueText] = bucket;
            }
            foreach (var symbol in symbols) bucket.Add(symbol);
        }
    }
    return values.ToDictionary(
        pair => pair.Key,
        pair => pair.Value.Order().ToArray(),
        StringComparer.Ordinal);
}
