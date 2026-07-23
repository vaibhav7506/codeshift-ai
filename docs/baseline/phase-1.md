# Phase 1 Baseline Report

Captured on 2026-07-23 from commit `a139667` before Phase 1 source changes.

## Existing architecture

- npm workspaces monorepo using Node.js 20+ and TypeScript.
- Next.js App Router web control surface in `apps/web`.
- Node.js CLI in `apps/cli`.
- Shared contracts in `packages/shared`.
- Repository analysis in `packages/analyzer`.
- Deterministic JavaScript-to-TypeScript planning and transformation in `packages/migrator`.
- Optional BYOK AI provider adapters in `packages/ai`.
- No database, authentication system, durable queue, or remote execution runner is present.

## Baseline commands and results

| Command | Result |
| --- | --- |
| `npm ci` | Passed. Refreshed stale workspace junctions left by a moved checkout. |
| `npm run build` | Passed. Next.js compiled and generated the existing routes. |
| `npm run typecheck` | Passed. |
| `npm test --workspaces --if-present` | Passed: 29 tests. |
| `npm run lint` | Not available: the root package has no lint script. |
| `node apps/cli/dist/index.js --help` | Passed and printed the existing five-command contract. |
| `npm audit` | Failed the security gate: two high-severity advisories through Next.js/sharp. |

The first check attempt failed because `node_modules/@codeshift/*` junctions pointed to
the repository's former location. This was an environment issue; `npm ci` repaired the
junctions without changing tracked source.

## Existing CLI contract

- `codeshift-ai analyze`
- `codeshift-ai plan --target js-to-ts --path <scope>`
- `codeshift-ai migrate --target js-to-ts --path <scope>`
- `codeshift-ai validate`
- `codeshift-ai pr`
- `--ai --provider openai` remains optional for migration explanations.

The CLI writes review artifacts under `.codeshift-ai/` and performs Git mutations only
inside the explicitly confirmed `pr` workflow.

## Existing web/API contract

- Pages: `/`, `/dashboard`, `/settings`.
- `POST /api/repos/analyze` returns `{ analysis }` or `{ error: { code, message } }`.
- `POST /api/plans/generate` returns `{ plan }` or the same stable error envelope.

## Visual baseline

- `docs/baseline/ui/home.png`
- `docs/baseline/ui/dashboard.png`
- `docs/baseline/ui/settings.png`

## Compatibility risks

- CLI output, artifact filenames, and JSON shapes are already documented public behavior.
- The migrator performs filesystem changes and must remain scope-bounded.
- The analyzer samples source text; source contents must not be logged or sent to AI.
- The web API currently accepts public GitHub repositories only.
- There is no durable persistence, so Phase 1 campaign and job storage must be explicitly
  replaceable and must not pretend to provide production durability.
- Incomplete recipe metadata must remain disabled by default.

## Phase 1 compatibility strategy

- Preserve all existing exports and CLI commands.
- Wrap JavaScript-to-TypeScript planning and transformation through a recipe adapter.
- Add new platform contracts and routes without changing existing response shapes.
- Use an in-memory control-plane repository behind interfaces until a datastore is selected
  in a later phase.
- Store checkpoints as metadata and content snapshots without performing implicit rollback.
- Keep all rollback operations explicit and caller-approved.
- Add linting and resolve the audited framework advisories as focused maintenance changes.

## Database migrations

None. The current project has no database layer. Phase 1 introduces persistence interfaces,
not a speculative database or ORM.
