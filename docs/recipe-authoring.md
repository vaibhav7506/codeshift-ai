# Recipe authoring and migration guide

Create a recipe with `codeshift-ai recipe create <name>`. The scaffold contains `recipe.manifest.json`, `src/index.ts`, and a detection fixture.

The manifest declares semantic version, engine range, runtime, permissions, capabilities, validation commands, fixtures, modifiable paths, and whether a signed package is mandatory. Request the smallest permission set. Detection and assessment should remain read-only. Only deterministic, reviewable steps should receive write permissions.

Implement the complete `MigrationRecipe` contract. Plans must be stable for the same input. Transform only approved paths, report every file change, explain behavior risk and unsupported assumptions, and provide rollback. Validation must produce evidence rather than relying on AI confidence.

Run:

```text
codeshift-ai recipe validate my-recipe
codeshift-ai recipe test my-recipe
codeshift-ai recipe inspect my-recipe
```

For an existing internal recipe, add a manifest without changing its public ID/version, map metadata to the SDK contract, add controlled fixtures, and register it through local loading. Increment major versions for incompatible plans/permissions. Signed-package verification trusts configured public keys and archive digests; there is no marketplace or remote installation flow.
