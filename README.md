# CodeShift AI

**CodeShift AI** is a review-first JavaScript-to-TypeScript migration workspace.

It analyzes legacy JavaScript repositories, creates scoped migration plans, applies conservative transformations, runs local validation, and opens GitHub pull requests only after human approval.

> Migrate code safely, one reviewable pull request at a time.

---

## Overview

Most AI code tools try to rewrite too much at once.

CodeShift AI takes a safer approach:

1. Analyze the repository.
2. Recommend a small migration scope.
3. Generate a deterministic migration plan.
4. Apply scoped JavaScript-to-TypeScript changes.
5. Run local validation.
6. Produce review artifacts.
7. Open a GitHub pull request only after approval.

The goal is not to replace code review.

The goal is to make migrations smaller, safer, and easier to review.

---
# Live Link Of Project

https://codeshiftweb.vercel.app/

## Demo

Demo Repository:

```txt
https://github.com/vaibhav7506/codeshift-ai-demo-legacy-js
```

Demo Pull Request:

```txt
https://github.com/vaibhav7506/codeshift-ai-demo-legacy-js/pull/1
```

The demo PR shows CodeShift AI migrating `src/utils` from JavaScript to TypeScript, validating the result locally, pushing a migration branch, and creating a reviewable pull request.

---

## Features

- Public GitHub repository analysis
- Migration readiness scoring
- Framework detection
- Package-manager detection
- Module-system detection
- JavaScript and TypeScript file counting
- Recommended migration scopes
- Deterministic JavaScript-to-TypeScript migration plans
- Local CLI workflow
- Scoped `.js` / `.jsx` to `.ts` / `.tsx` migration
- Conservative CommonJS handling
- `tsconfig.json` creation or update
- Patch and migration summary artifacts
- Local validation runner
- GitHub branch, commit, push, and PR flow
- Separate confirmation before every Git mutation
- Optional BYOK AI explanations
- OpenAI adapter implemented
- Groq, Gemini, and Anthropic provider interfaces
- Light, dark, and system themes
- Professional dashboard for repository analysis and planning

---

## Tech Stack

### Web App

- Next.js
- React
- TypeScript
- Tailwind CSS

### CLI

- Node.js
- TypeScript
- Git integration
- Local filesystem analysis
- Local validation runner

### Packages

```txt
apps/
  web/         Next.js product and dashboard interface
  cli/         Local analysis, migration, validation, and PR workflow

packages/
  shared/      Shared types and product constants
  analyzer/    Repository analysis and readiness scoring
  migrator/    Migration planning, safe transforms, and diff generation
  ai/          BYOK provider contracts and AI adapters
```

---

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- Git
- GitHub repository remote for the pull request workflow

---

## Running the Web App Locally

Install dependencies:

```bash
npm install
```

Start the web app:

```bash
npm run dev --workspace=apps/web
```

Open:

```txt
http://localhost:3000
```

Useful pages:

```txt
http://localhost:3000
http://localhost:3000/dashboard
http://localhost:3000/settings
```

Public repository analysis works without credentials.

To increase GitHub API rate limits, create:

```txt
apps/web/.env.local
```

Add a read-only GitHub token there.

Do not expose tokens through `NEXT_PUBLIC_` variables.

---

## Workspace Commands

```bash
npm run dev
npm run build
npm run typecheck
npm test --workspace=packages/ai
npm test --workspace=packages/analyzer
npm test --workspace=packages/migrator
npm test --workspace=apps/cli
```

---

## Installing the CLI Locally

Build and link the CLI:

```bash
npm install
npm run build
npm link --workspace=@codeshift/cli
```

Verify:

```bash
codeshift-ai --help
```

Without linking, run the compiled CLI directly:

```bash
node /path/to/codeshift-ai/apps/cli/dist/index.js analyze
```

---

## Complete Migration Workflow

Use a disposable copy of a legacy JavaScript repository.

The target repository should already be initialized with Git and should have a GitHub remote.

```bash
cd /path/to/legacy-javascript-repository

git status
git remote -v
```

Run CodeShift AI:

```bash
codeshift-ai analyze
codeshift-ai plan --target js-to-ts --path src/utils
codeshift-ai migrate --target js-to-ts --path src/utils
codeshift-ai validate
```

Review generated files and artifacts:

```bash
git diff
cat .codeshift-ai/migration-summary.json
cat .codeshift-ai/patch.diff
cat .codeshift-ai/validation-result.json
cat .codeshift-ai/validation-logs.txt
```

---

## Creating a Pull Request

Set a GitHub token only in the current shell.

For HTTPS remotes, the token needs repository contents write access.

For PR creation, it also needs pull request write access.

### macOS / Linux

```bash
export GITHUB_TOKEN="your-token"
codeshift-ai pr
```

### Windows PowerShell

```powershell
$env:GITHUB_TOKEN="your-token"
codeshift-ai pr
```

The PR command shows:

- migration target
- selected scope
- changed files
- warnings
- validation results
- base branch
- proposed migration branch

Then it asks separately before:

1. creating a branch
2. committing migration files
3. pushing the branch
4. opening the pull request

CodeShift AI does not commit, push, or create a PR during `migrate`.

Those operations happen only in:

```bash
codeshift-ai pr
```

and only after explicit approval.

---

## CLI Command Behavior

### `codeshift-ai analyze`

Analyzes the current repository and writes:

```txt
.codeshift-ai/analysis.json
```

It detects:

- framework
- package manager
- module system
- JavaScript and TypeScript file counts
- scripts
- readiness score
- recommended migration scopes

---

### `codeshift-ai plan`

Creates a deterministic migration plan and writes:

```txt
.codeshift-ai/migration-plan.json
```

Example:

```bash
codeshift-ai plan --target js-to-ts --path src/utils
```

This command does not modify source files.

---

### `codeshift-ai migrate`

Applies a scoped JavaScript-to-TypeScript migration.

Example:

```bash
codeshift-ai migrate --target js-to-ts --path src/utils
```

It may:

- rename `.js` files to `.ts`
- rename `.jsx` files to `.tsx`
- create or update `tsconfig.json`
- apply conservative syntax transformations
- leave complex CommonJS cases unchanged with warnings

It writes:

```txt
.codeshift-ai/patch.diff
.codeshift-ai/migration-summary.json
```

It does not commit changes.

---

### `codeshift-ai validate`

Runs only existing local scripts:

- `test`
- `build`
- `typecheck`
- `lint`

Missing scripts are recorded as `SKIPPED`.

It writes:

```txt
.codeshift-ai/validation-result.json
.codeshift-ai/validation-logs.txt
```

---

### `codeshift-ai pr`

Creates a reviewable GitHub pull request after explicit approval.

It requires:

- migration summary
- Git repository
- GitHub remote
- migration changes or a local migration branch flow

It stages only files associated with the recorded migration.

---

## Optional BYOK AI

The deterministic migration workflow does not require AI.

For optional AI-generated explanations and PR summaries, provide your own OpenAI key.

BYOK means:

> Bring Your Own Key.

CodeShift AI does not pay for or store user AI usage.

### macOS / Linux

```bash
export OPENAI_API_KEY="your-key"
codeshift-ai migrate --target js-to-ts --path src/utils --ai --provider openai
```

### Windows PowerShell

```powershell
$env:OPENAI_API_KEY="your-key"
codeshift-ai migrate --target js-to-ts --path src/utils --ai --provider openai
```

AI output is written to:

```txt
.codeshift-ai/ai-enhancement.json
```

The API key is read from the process environment and is never written to artifacts or logs.

OpenAI is implemented.

Groq, Gemini, and Anthropic currently have clean provider stubs.

AI output is advisory and cannot expand the selected migration scope.

---

## Safety Model

CodeShift AI separates planning from execution.

The web app can analyze public repository metadata and generate migration plans, but it does not:

- clone repositories
- install dependencies
- run repository code
- execute package scripts
- mutate files on a remote server

Actual file changes and validation happen locally through the CLI.

This avoids unsafe server-side execution of unknown repositories.

CodeShift AI also avoids fully autonomous PR creation. Every Git mutation requires explicit confirmation.

---

## Theme System

CodeShift AI supports:

- light mode
- dark mode
- system mode

The first visit follows the operating-system preference.

Users can change the theme from the navbar, dashboard, or settings page.

The preference is stored in `localStorage`.

---

## Demo Repository

A small demo repository is available here:

```txt
https://github.com/vaibhav7506/codeshift-ai-demo-legacy-js
```

Demo PR:

```txt
https://github.com/vaibhav7506/codeshift-ai-demo-legacy-js/pull/1
```

This demo shows the intended workflow:

```bash
codeshift-ai analyze
codeshift-ai plan --target js-to-ts --path src/utils
codeshift-ai migrate --target js-to-ts --path src/utils
codeshift-ai validate
codeshift-ai pr
```

---

## Current Status

CodeShift AI MVP is complete.

Completed areas:

- landing, theme, and architecture scaffold
- public repository analyzer
- migration readiness scoring
- deterministic migration planner
- local CLI analyze and plan commands
- JavaScript-to-TypeScript migrator
- diff generation
- local validation runner
- BYOK AI provider layer
- GitHub PR workflow

---

## Known MVP Limitations

- Only GitHub.com remotes are supported.
- GitHub Enterprise Server is not supported yet.
- `origin` is preferred; otherwise the first configured remote is used.
- The current checked-out branch is used as the PR base.
- Fork-based PRs are not implemented yet.
- Draft PRs are not implemented yet.
- Updating an existing PR is not implemented yet.
- Web-created PRs are not implemented yet.
- Groq, Gemini, and Anthropic adapters are interface-complete stubs.
- Complex CommonJS syntax is preserved instead of aggressively rewritten.

---

## Roadmap

Planned improvements:

- GitHub Actions-based web execution
- web-based migration run history
- richer diff viewer
- PR status tracking inside the dashboard
- GitHub Enterprise support
- fork-based PR support
- draft PR support
- full Groq, Gemini, and Anthropic adapters
- React class component to hooks migration
- Express to Hono migration
- CSS to Tailwind migration
- migration recipes marketplace

---

## Project Philosophy

CodeShift AI is not trying to replace code review.

It is designed to make migrations smaller, safer, and easier to inspect.

The ideal output is not a massive automatic rewrite.

The ideal output is a clean pull request that a developer can confidently review, test, and merge.

---

## License

MIT