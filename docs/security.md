# Security, permissions, and approvals

## Security model

- Treat repository content and recipe packages as untrusted.
- Execute transformations only in scoped local or isolated runner contexts.
- Require HTTPS repository URLs and allowlisted hosts; reject credentials and private-network targets.
- Verify GitHub webhooks with HMAC SHA-256 and constant-time comparison.
- Encrypt workspace AI credentials with AES-256-GCM; never return plaintext.
- Exclude source, diffs, content, secrets, tokens, and passwords from telemetry and audit data.
- Apply payload limits, same-origin mutation checks, CSRF markers, rate limits, security headers, and denied CORS.
- Require durable TLS database/object storage and strong external secrets in staging/production.

## Permission model

Roles are Owner, Administrator, Platform Engineer, Migration Author, Reviewer, Approver, Developer, Auditor, and Read Only. Server permissions cover repository connection, analysis, campaigns, scope and execution approval, AI configuration, runners, retention, audit, integrations, billing, usage, and organization administration.

Roles come from a verified membership. They are never accepted from an approval body. Organizational identity headers must be signed by the trusted identity gateway using `CODESHIFT_IDENTITY_SECRET`.

## Approval model

Execution needs at least one approver. High-risk work needs two distinct approvers. Authors cannot approve their own work. Security, platform, and database changes require the corresponding specialist authority or an owner. Validation must pass before approval. Pull-request creation additionally requires approved policy and final validation.

## Incident response

1. Revoke affected runner and integration credentials.
2. Disable AI credentials and rotate workspace encryption/provider keys.
3. Preserve audit, request IDs, deployment version, and runner metadata—never repository content in the incident ticket.
4. Block campaigns and pull-request creation for the tenant.
5. Restore from a verified backup into an isolated environment.
6. Validate audit-chain integrity, tenant isolation, and webhook rotation before reopening.
7. Record timeline, scope, corrective controls, and notification decisions.
