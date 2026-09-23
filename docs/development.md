# Local development and troubleshooting

Requirements: Node.js 20.9 or newer (CI/container use Node 22), npm 10+, Git, and the .NET SDK only for native .NET fixture validation.

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run dev
```

Copy `apps/web/.env.example` to an ignored local environment file. Development defaults to in-memory adapters and public GitHub analysis. Run `npm run deployment:validate` after configuration changes.

Common issues:

- GitHub rate limits: set a least-privilege `GITHUB_TOKEN`.
- Readiness 503: inspect `/api/v1/health/ready`; staging/production require durable TLS services and strong secrets.
- Identity 503/401: configure the gateway secret and sign the complete identity tuple.
- Recipe validation failure: run `codeshift-ai recipe inspect <name>` and correct the manifest before executing source.
- Validation command missing: install the repository’s package manager and restore its lockfile.
- .NET native evidence missing: use a registered runner with the configured target SDK.
- Stale Next build: stop the server, rebuild, then start it again.
