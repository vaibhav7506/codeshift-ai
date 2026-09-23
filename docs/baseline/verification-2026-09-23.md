# Verification follow-up — 2026-09-23

## Scope and current status

Completed the Phase 5 verification on `codex/phase-5-production-readiness` in the moved `Working Projects/CodeShift AI` checkout. The existing application work was preserved, organized into six reviewable commits, pushed to GitHub, and successfully deployed by Vercel.

The local Node application passes the checks below. The complete enterprise production exit gate remains open; local passing checks do not prove that the documented infrastructure contracts have production implementations.

## Changes in this follow-up

- Restored incomplete dependencies with `npm ci --ignore-scripts`.
- `package.json` and `package-lock.json`: declared Node >=20.9.0, matching installed Next.js 16.3.6; CI/container use Node 22.
- `scripts/secret-scan.mjs`: tolerate deleted tracked files; include non-ignored untracked files; deduplicate paths and count files actually scanned.
- `scripts/secret-scan.test.mjs`: regression coverage for deleted tracked files, untracked secrets, ignored files, and avoiding credential values in findings. Runs through `npm run security:secrets` in CI.
- Updated runtime requirements and verification facts in the documentation.

The final delivery includes the recipe catalog, governance controls, campaign execution flow, dashboard workflow corrections, secret-scanner coverage, Next.js 16 compatibility, and standalone deployment preparation. No database migration was required.

## Executed checks

| Check | Result |
| --- | --- |
| `npm ci --ignore-scripts` | Passed; 230 packages installed, zero reported vulnerabilities. |
| `npm run lint` | Passed before scanner changes; targeted ESLint passed for both scanner files afterward. |
| `npm run typecheck` | Passed across all workspaces. |
| `npm test` | Passed: 81 tests (CLI 19, runner 2, AI 4, analyzer 4, migrator 7, platform 45). |
| `npm run build` | Passed across all workspaces, including Next.js production output and standalone assets. |
| `npm run deployment:validate` | Passed for four environment templates; validates configuration, not deployed infrastructure. |
| `npm run security:secrets` | Passed: one scanner regression test and no high-confidence secrets in 236 working-tree files before this report was added. |
| `npm audit --audit-level=moderate` | Passed on final retry: zero vulnerabilities. One earlier registry request returned HTTP 400; it was not treated as a pass. |
| `npm audit --omit=dev --audit-level=moderate` | Passed: zero vulnerabilities. |
| `npm run package:cli` / `npm run package:runner` | Passed dry-runs. No packages published. |
| `node apps/cli/dist/index.js --help` | Passed; legacy and campaign/recipe commands present. |
| Local HTTP smoke check | 17 pages/API endpoints returned 200; 16 referenced static assets loaded successfully. |
| `npm run load:test` against local liveness | 100 requests, concurrency 10, zero failures, p95 55 ms. Not a production capacity benchmark. |

HTTP routes checked: `/`, `/dashboard`, `/repositories`, `/recipes`, `/campaigns`, `/organization`, `/organization/members`, `/organization/policies`, `/integrations`, `/runners`, `/audit`, `/usage`, `/settings`, `/api/v1/health/live`, `/api/v1/health/ready`, `/api/v1/recipes`, `/api/v1/openapi`.

The preview runs at http://localhost:3100. These were HTTP/asset checks, not a browser interaction or visual regression test.

## Remaining gate items

- No .NET SDK is installed (`dotnet --list-sdks` returned no entries). Native Roslyn build and .NET runtime validation remain unverified.
- Docker CLI is installed but its daemon is unavailable. Container build/runtime verification remains unverified.
- Vercel completed the branch deployment successfully. Repository-wide GitHub Actions were not independently inspected in this local verification.
- Durable PostgreSQL/object-storage adapters, an enforcing runner sandbox scheduler, and live GitHub installation/token integration remain documented production gaps.
- Real identity/deployment integration and end-to-end production tenant workflows require validation before production use.

The Node/Vercel delivery gate is complete. The infrastructure items above remain explicit production prerequisites rather than hidden application failures.

## Run locally

Use Node 22 and npm 10+ from the actual moved repository directory:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run security:secrets
npm run deployment:validate
npm audit --audit-level=moderate
$env:PORT = '3100'
$env:HOSTNAME = '127.0.0.1'
npm run start --workspace=apps/web
```

The existing preview already occupies port 3100; stop that preview before starting a replacement. For native validation on an SDK-equipped machine, run `dotnet build tools/dotnet-analyzer/CodeShift.DotNet.Analyzer.csproj --configuration Release`. With a running Docker daemon, run `docker build -t codeshift-ai:local .`.

## Rollback

No database rollback is required. The delivery is split across commits `bcc56ef` through `84b4e00`, allowing individual Git reverts by concern. Reverting the Node requirement without also downgrading Next.js would reintroduce an inaccurate compatibility declaration.
