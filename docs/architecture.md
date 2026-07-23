# Architecture

## System overview

CodeShift AI is an npm-workspace monorepo. `apps/web` is the control-plane UI and API, `apps/cli` is the local workflow, and packages provide analysis, deterministic migration, optional AI, shared contracts, recipes, campaigns, governance, and production controls.

The control plane stores intent, policy, approvals, checkpoints, audit metadata, and execution evidence. Repository code is processed locally by the CLI or by an explicitly registered isolated runner. AI is optional and never replaces deterministic validation or human approval.

## Control plane

Requests enter versioned `/api/v1` routes, receive request/correlation IDs, then pass rate limits, identity verification, tenant resolution, authorization, validation, policy, and audit boundaries. Personal mode resolves to a fixed personal owner. Organization identity headers are accepted only with the configured gateway HMAC.

Current repositories are in-memory adapters. Their interfaces intentionally separate domain logic from the production PostgreSQL/object-storage implementations still required for a durable deployment.

## Runner architecture

Runners register with a one-time ten-minute token and receive a one-hour credential. Heartbeats require that credential; revocation removes it immediately. The isolation policy specifies CPU, memory, timeout, read-only root, denied-by-default network, sanitized logs, post-job cleanup, and no repository persistence.

An actual production runner must enforce those controls with an OS/container sandbox. The current repository provides the registration, identity, policy, lifecycle, and revocation contracts—not a container scheduler.

## Recipe engine

Recipes implement detection, assessment, planning, transformation, validation, explanation, and rollback contracts. Metadata declares versions, permissions, capabilities, compatible technologies, tools, modifiable paths, risk, validation, AI policy, and dependencies. Campaign orchestration resolves dependencies without knowing recipe implementation details.

The Recipe SDK adds versioned manifests, compatibility metadata, fixture contracts, safe local manifest loading, and a trusted-signer verification boundary. Inspection never imports untrusted recipe code.

## Campaign lifecycle

Campaigns move through draft, analysis, review, approval, queue, isolated execution, validation, final approval, completion, or rollback. Invalid transitions fail closed. Optimistic versions prevent lost updates. Checkpoints bind commit, file, configuration, lockfile, and validation evidence. Failed jobs can retry, dead-letter, resume, cancel, or roll back.

Pull requests remain blocked until validation, workspace policy, and final approval succeed.

## Data model

Core tenant keys are `organizationId` and `workspaceId`. Organizations own workspaces; memberships assign roles; invitations have bounded lifecycles; repositories, campaigns, runners, policies, credentials, usage events, and audit events are workspace scoped.

Audit events form a SHA-256 hash chain. BYOK credentials use AES-256-GCM. Usage events are append-only quantities. Production adapters should use transaction boundaries and preserve optimistic campaign versions.
