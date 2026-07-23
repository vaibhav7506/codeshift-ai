# CLI

Build with `npm run build --workspace=@codeshift/cli`. The binary is `codeshift-ai`.

```text
codeshift-ai analyze
codeshift-ai plan --target js-to-ts --path src/utils
codeshift-ai migrate --target js-to-ts --path src/utils
codeshift-ai validate
codeshift-ai pr
codeshift-ai recipe create my-recipe
codeshift-ai recipe validate my-recipe
codeshift-ai recipe test my-recipe
codeshift-ai recipe inspect my-recipe
```

Analysis and planning do not execute repository code. Migration changes only the approved scope and does not commit. Validation runs discovered scripts and saves redacted evidence. `pr` requires explicit review/approval.

AI is optional BYOK. Set the provider key in the shell, never in repository files. Deterministic migration completes before AI enhancement begins.

Recipe projects live in `.codeshift-ai/recipes`. Validation and inspection read bounded JSON manifests/fixtures without importing recipe source.
