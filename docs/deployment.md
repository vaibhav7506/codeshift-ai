# Deployment, backup, recovery, and upgrades

## Environments

Configuration templates live in `config/environments`. Run `npm run deployment:validate`. Development/test may use ephemeral persistence. Staging/production require HTTPS, PostgreSQL with verified TLS, externally supplied encryption/identity/webhook secrets, retention, and object lifecycle policies.

The Dockerfile builds the standalone web application, runs as a non-root user, and exposes liveness health checks. Build with:

```text
docker build -t codeshift-ai:local .
```

The repository does not provision PostgreSQL, object storage, queues, or a sandbox scheduler. Do not call an in-memory deployment production-ready.

## Backups and restore

Back up the relational database with point-in-time recovery, versioned object storage, audit exports, encryption-key metadata, and deployment manifests. Never include plaintext provider keys or repository working copies.

Restore into an isolated environment; restore database and objects to one consistent timestamp; supply the matching key version; run migrations; verify tenant queries, audit chain, runner revocation, and a read-only campaign; then switch traffic.

## Key rotation and retention

Rotate identity, webhook, runner, and BYOK keys independently. Allow dual verification only for a bounded transition, then revoke the old version. Logs default to 30 days, audit to the configured policy, and objects to lifecycle rules. Legal requirements override defaults.

## Rollback and disaster recovery

Application rollback means redeploying the previous immutable image and applying only a migration’s explicit rollback when data compatibility permits. Campaign rollback uses checkpoints/reverse patches and separate approval. Define RPO/RTO with the hosting team and test recovery regularly.

## Upgrade guide

1. Read release and known-limitation notes.
2. Back up durable state and export migration checksums.
3. Validate environment and ordered migrations.
4. Deploy to staging; run API, tenant, runner, campaign, rollback, and recipe SDK tests.
5. Rotate incompatible credentials if required.
6. Deploy an immutable production artifact and monitor failure, latency, queue, and resource thresholds.

## Known limitations

This repository includes in-memory control-plane adapters, a GitHub provider contract rather than live installation provisioning, and runner isolation policy rather than a container scheduler. A durable adapter implementation and infrastructure deployment are required before serving production tenants.
