# CodeShift AI

**CodeShift AI** is a review-first JavaScript-to-TypeScript migration workspace.

It helps developers analyze legacy JavaScript repositories, generate a safe migration plan, apply scoped transformations, run local validation, and open a GitHub pull request only after human approval.

The goal is simple:

> Migrate code safely, one reviewable pull request at a time.

---

## Why CodeShift AI?

Most AI code tools try to rewrite too much at once.

CodeShift AI takes a different approach:

- analyze the repository first
- choose a small migration scope
- generate a deterministic plan
- apply conservative JavaScript-to-TypeScript changes
- run local validation
- produce review artifacts
- create a pull request only after approval

It is designed for developers who want controlled, inspectable migrations instead of large, risky AI rewrites.

---

## Demo

A complete demo PR is available here:

**Demo PR:**  
https://github.com/vaibhav7506/codeshift-ai-demo-legacy-js/pull/1

In that demo, CodeShift AI migrated `src/utils` from JavaScript to TypeScript, generated validation artifacts, pushed a migration branch, and opened a reviewable pull request.

---

## Features

- Public GitHub repository analysis
- Migration readiness scoring
- Framework and package-manager detection
- Selectable migration scopes
- Deterministic JavaScript-to-TypeScript migration plans
- Local CLI for real code changes
- Scoped `.js` / `.jsx` to `.ts` / `.tsx` migration
- Conservative CommonJS handling
- Local validation runner
- Review artifacts under `.codeshift-ai/`
- Optional BYOK AI explanations using OpenAI
- Provider interface for OpenAI, Groq, Gemini, and Anthropic
- GitHub branch, commit, push, and PR flow
- Separate confirmation before every Git mutation
- Light, dark, and system themes

---

## Tech Stack

### Web

- Next.js
- React
- TypeScript
- Tailwind CSS

### CLI

- Node.js
- TypeScript
- Git integration
- Local filesystem analysis
- Validation runner

### Packages

```text
apps/
  web/         Next.js product and dashboard interface
  cli/         Local analysis, migration, validation, and PR workflow

packages/
  shared/      Shared types and product constants
  analyzer/    Repository analysis and readiness scoring
  migrator/    Migration planning, transforms, and diff generation
  ai/          BYOK provider contracts and AI adapters