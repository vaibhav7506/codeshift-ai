# Runner setup

The `@codeshift/runner` package validates registration metadata and emits the required isolation manifest.

```text
CODESHIFT_RUNNER_ID=runner-linux-1
CODESHIFT_CONTROL_PLANE_URL=https://codeshift.example
CODESHIFT_RUNNER_LABELS=linux,x64
CODESHIFT_RUNNER_RUNTIMES=node20,dotnet8
CODESHIFT_RUNNER_CAPACITY=2
codeshift-runner
```

Use a one-time control-plane pairing token during the real service enrollment flow; never place it in the environment template or image. The resulting credential expires after one hour and is required for heartbeats.

Run the package as a non-root identity in an ephemeral sandbox with the emitted CPU, memory, timeout, network, read-only-root, log-redaction, and cleanup policy. Mount one empty job directory, deny host sockets and cloud metadata endpoints, and destroy the directory after each job.

The package intentionally does not pretend to be a container scheduler. Production deployment must provide a sandbox adapter that enforces the manifest and reports resource usage, job state, version, and heartbeats to the control plane.
