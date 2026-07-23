# Environment-variable reference

| Variable | Scope | Purpose |
|---|---|---|
| `CODESHIFT_ENV` | Web | `development`, `test`, `staging`, or `production` |
| `CODESHIFT_PUBLIC_URL` | Web | HTTPS public base URL outside local/test |
| `DATABASE_URL` | Web | PostgreSQL URL with `sslmode=verify-full` or `require` |
| `CODESHIFT_ENCRYPTION_KEY` | Web | External 32+ character vault master key |
| `CODESHIFT_IDENTITY_SECRET` | Web | External 32+ character gateway HMAC secret |
| `GITHUB_WEBHOOK_SECRET` | Web | External 32+ character webhook secret |
| `GITHUB_TOKEN` | Web/CLI | Optional least-privilege GitHub access |
| `CODESHIFT_LOG_RETENTION_DAYS` | Web | Structured-log retention |
| `CODESHIFT_AUDIT_RETENTION_DAYS` | Web | Audit retention |
| `CODESHIFT_OBJECT_LIFECYCLE_DAYS` | Web | Evidence-object lifecycle |
| `OPENAI_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` | CLI | Optional provider BYOK |
| `CODESHIFT_RUNNER_ID` | Runner | Stable runner identity |
| `CODESHIFT_CONTROL_PLANE_URL` | Runner | HTTPS control-plane URL |
| `CODESHIFT_RUNNER_LABELS` | Runner | Comma-separated scheduling labels |
| `CODESHIFT_RUNNER_RUNTIMES` | Runner | Comma-separated runtime inventory |
| `CODESHIFT_RUNNER_CAPACITY` | Runner | Integer concurrency, 1–32 |
| `CODESHIFT_RUNNER_WORK_DIRECTORY` | Runner | Ephemeral job directory |

Never use `NEXT_PUBLIC_` for secrets. Staging/production secrets must come from the deployment secret manager, not JSON configuration, images, logs, or repository files.
