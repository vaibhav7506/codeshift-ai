# CodeShift AI

CodeShift AI is a governed, review-first code modernization platform. It analyzes repositories, recommends modular recipes, builds dependency-aware campaigns, captures behavioral evidence, applies approved changes locally or through registered runners, and permits pull requests only after validation and human approval.

The platform supports JavaScript/TypeScript modernization, staged enterprise .NET assessment, personal and organization workspaces, policy/RBAC/approval controls, audit evidence, optional BYOK AI, operational telemetry, usage limits, and an internal Recipe SDK.

> The repository contains a complete reference platform and production contracts. Durable database/object-storage adapters and an enforcing sandbox scheduler are still required before serving real production tenants.

## Verified status

- 81 workspace tests plus a secret-scanner regression test across CLI, runner, analyzer, migrator, AI, governance, recipes, recovery, security, and production controls
- TypeScript strict typecheck and ESLint across every workspace
- Next.js production build with standalone static assets
- 16 versioned modernization recipes
- Versioned `/api/v1` surface and OpenAPI contract
- Four validated deployment environment templates
- Non-root, health-checked standalone container build
- CI for tests, security scans, dependency audit, CodeQL, container build, SBOM, licence inventory, CLI packaging, and runner packaging

See [verification results and remaining production gates](docs/baseline/verification-2026-09-23.md).

## Architecture

```text
apps/
  web/       Next.js control plane, APIs, governance and review UI
  cli/       Local analysis, migration, validation, PR and Recipe SDK commands
  runner/    Runner configuration, packaging and isolation manifest

packages/
  shared/    Shared migration and analysis contracts
  analyzer/  Repository inventory, readiness and risk inputs
  migrator/  Deterministic JS-to-TS planning and transformation
  ai/        Optional provider-agnostic BYOK enhancements
  platform/  Recipes, campaigns, checkpoints, jobs, governance,
             observability, reliability, metering and deployment contracts
```

Repository code stays outside the web control plane. It is changed through the local CLI or an isolated runner. The control plane coordinates tenant intent, policies, approvals, checkpoints, evidence, audit metadata, integrations, and usage.

See [Architecture](docs/architecture.md), [Security](docs/security.md), and [Deployment](docs/deployment.md).

## Requirements

- Node.js 20.9+; Node.js 22 is used by CI and the container
- npm 10+
- Git
- Optional .NET SDK on a capable runner for native .NET validation

## Local development

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run deployment:validate
npm run dev
```

Open `http://localhost:3000`. Copy `apps/web/.env.example` to an ignored local environment file when credentials or non-default settings are needed.

Useful commands:

```bash
npm run build
npm run format:check
npm run package:cli
npm run package:runner
npm audit --audit-level=moderate
```

## Product workflow

1. Connect or select a repository.
2. Run structured repository analysis.
3. Review technologies, dependencies, risks, and recommended scope.
4. Select versioned modernization recipes.
5. Create a dependency-aware campaign.
6. Configure approved scope and protected files.
7. Capture a behavioral baseline and checkpoint.
8. Obtain required execution approvals.
9. Execute locally or through a registered isolated runner.
10. Review rich diffs, reasons, assumptions, tests, and validation evidence.
11. Approve, reject, retry, resume, cancel, or roll back.
12. Obtain final approval and create a pull request.
13. Track campaign, runner, audit, cost, duration, and PR status.

Risk is explainable and includes change size, dependency fan-in, complexity, coverage, authentication, payments, database involvement, runtime/framework changes, unsupported dependencies, dynamic behavior, reflection, native/Windows APIs, missing tests, deterministic confidence, and historical failures. AI confidence never lowers risk.

## CLI

Build and link:

```bash
npm run build --workspace=@codeshift/cli
npm link --workspace=@codeshift/cli
codeshift-ai --help
```

Migration workflow:

```bash
codeshift-ai analyze
codeshift-ai plan --target js-to-ts --path src/utils
codeshift-ai migrate --target js-to-ts --path src/utils
codeshift-ai validate
codeshift-ai pr
```

The migrate command does not commit or push. Git mutations occur only through `pr` after separate confirmation.

Approved campaign workflow:

```bash
codeshift-ai recipes list
codeshift-ai campaign connect --campaign <campaign-id> --token <temporary-token>
codeshift-ai campaign preflight --campaign <campaign-id>
codeshift-ai campaign execute --campaign <campaign-id>
codeshift-ai campaign validate --campaign <campaign-id>
codeshift-ai campaign report --campaign <campaign-id>
codeshift-ai campaign rollback --campaign <campaign-id>
codeshift-ai campaign create-pr --campaign <campaign-id>
```

Campaign execution reads the selected recipe and approved scope from the signed, short-lived campaign context. It does not fall back to JavaScript-to-TypeScript.

Recipe SDK:

```bash
codeshift-ai recipe create my-recipe
codeshift-ai recipe validate my-recipe
codeshift-ai recipe test my-recipe
codeshift-ai recipe inspect my-recipe
```

Recipe inspection validates bounded manifests and fixtures without importing untrusted source. See [CLI](docs/cli.md) and [Recipe authoring](docs/recipe-authoring.md).

## Modernization recipes

The catalog includes:

- JavaScript to TypeScript
- CommonJS to ESM
- Express to Hono
- Callbacks to async/await
- React classes to hooks
- CSS to Tailwind CSS
- ESLint flat configuration
- Jest to Vitest
- Typed environment configuration
- Deprecated dependency assessment
- Edge-runtime assessment
- .NET Framework to modern .NET
- ASP.NET to ASP.NET Core
- Entity Framework 6 to EF Core assessment
- WCF modernization assessment
- Windows Service to Worker Service

Transformations are deterministic or explicitly marked assessment/scaffold-only. Unsupported cases remain unchanged with review evidence.

## Governance and security

- Organization/workspace tenant keys and personal-workspace compatibility
- Nine predefined roles with server-side permission checks
- One approval before execution; two for high risk
- No self-approval and specialist gates for security/platform/database changes
- Policy allowlists, protected paths, risk/file limits, required tests/reviewers, vulnerability/licence hooks, AI/source-sharing controls
- One-time runner pairing, short-lived heartbeat credentials and revocation
- GitHub webhook HMAC verification and approval-gated PR boundary
- Append-only hash-chained audit events without source or secrets
- AES-256-GCM BYOK storage, rotation, disablement, consent and zero-retention defaults
- Rate limits, CSRF/origin checks, input limits, SSRF defenses, security headers and signed organization identity

## API

New clients use `/api/v1`. OpenAPI is available at `/api/v1/openapi`.

The API includes:

- Liveness and readiness
- Repository analysis and migration plans
- Paginated/filterable/sortable recipes and campaigns
- Approvals, runner revocation and GitHub integration boundaries
- Encrypted AI credentials
- Usage and protected metrics
- Stable errors, request/correlation IDs, rate limits, authorization and idempotency requirements

Legacy unversioned routes remain for current UI/CLI compatibility. See [API documentation](docs/api.md).

## Observability and reliability

Production contracts provide redacted JSON telemetry, correlation/trace spans, counters/gauges, health aggregation, error-tracker adapters, alert thresholds, resource metrics, bounded retry/backoff, timeouts, circuit breakers, concurrency/backpressure, dead letters, cancellation, resume, transactions, optimistic campaign versions, connection-pool interfaces, graceful shutdown, and partial-failure rollback.

Telemetry never records repository source, diffs, file content, passwords, tokens, or provider keys.

## Deployment

Validate configuration:

```bash
npm run deployment:validate
```

Build the container:

```bash
docker build -t codeshift-ai:local .
```

Development/test may use ephemeral adapters. Staging/production readiness fails unless HTTPS, TLS PostgreSQL, external encryption/identity/webhook secrets, and retention/lifecycle policies are configured.

The CI workflow never deploys code from a pull request. Release jobs on trusted `main` pushes create artifacts only; environment deployment remains a separately authorized operation.

## Documentation

- [Architecture and data model](docs/architecture.md)
- [Security, permissions, approvals and incident response](docs/security.md)
- [API](docs/api.md)
- [CLI](docs/cli.md)
- [Local development and troubleshooting](docs/development.md)
- [Deployment, backup, restore, rollback and upgrades](docs/deployment.md)
- [Environment variables](docs/environment.md)
- [Runner setup](docs/runner-setup.md)
- [Recipe authoring](docs/recipe-authoring.md)
- [.NET modernization](docs/guides/dotnet-modernization.md)
- [Express to Hono](docs/guides/express-to-hono.md)
- [Behavioral validation](docs/guides/behavioural-validation.md)

## Known limitations

- Control-plane repositories are in-memory reference adapters; production needs durable PostgreSQL and object-storage implementations.
- The runner package validates and emits isolation requirements; production needs an OS/container sandbox scheduler that enforces them.
- GitHub provider operations are contract-first; live installation provisioning and token exchange require deployment integration.
- Groq, Gemini, and Anthropic remain provider stubs.
- There is no public recipe marketplace, billing processor, or automatic invoice collection.
- GitHub Enterprise, forks, and automatic existing-PR updates are not implemented.

These limitations are deliberately exposed rather than presented as production-ready features.

## License

MIT
