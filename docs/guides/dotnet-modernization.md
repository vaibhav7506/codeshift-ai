# .NET modernization

.NET work is assessment-first. Structural solution, MSBuild XML, configuration, packages, and Roslyn semantic manifests produce compatibility and risk evidence before any source change.

Project conversion is permitted only for controlled projects without blockers such as COM references or custom targets. ASP.NET Core work starts with additive scaffolds and route/auth parity evidence. EF6 and WCF remain report-only until database/protocol decisions and specialist approvals exist. Windows Services may receive an additive Worker Service scaffold.

Pin the target framework in the campaign manifest, preserve `packages.config` until restore succeeds, require native restore/build/test on an isolated runner, and compare route, authorization, serialization, database, and operational behavior. Never infer semantic safety by parsing C# text.
