# API

The stable API prefix is `/api/v1`. OpenAPI is served by `GET /api/v1/openapi`. A typed client scaffold is in `apps/web/src/lib/api-client.ts`.

Every API response carries `X-Request-Id` and `X-Correlation-Id`. Error bodies use:

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "Safe explanation.",
    "requestId": "correlation value"
  }
}
```

List endpoints accept `page`, `pageSize` (maximum 100), `filter`, and `sort=asc|desc`, returning `data` and `meta`. Campaign creation requires `Idempotency-Key`. Mutations require same-origin requests and `X-CodeShift-CSRF: 1`.

Personal requests omit identity headers. An organization gateway supplies user, organization, workspace, role, and `X-CodeShift-Identity-Signature`; partial or invalid identities fail closed.

Key endpoints:

- `GET /health/live`, `GET /health/ready`
- `GET /recipes`
- `POST /repos/analyze`
- `POST /plans/generate`
- `GET|POST /campaigns`
- `POST /approvals`
- `POST /runners/revoke`
- `POST /integrations/github/pull-requests`
- `POST /integrations/github/webhook`
- `POST /settings/ai-credentials`

Unversioned Phase 1 routes remain only for CLI/UI compatibility and should not be used by new clients.
