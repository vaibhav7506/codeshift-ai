import assert from "node:assert/strict";
import test from "node:test";
import { resolveRunnerConfiguration, runnerPackageManifest } from "./index.js";

test("runner package validates secure configuration and emits isolation policy", () => {
  const configuration = resolveRunnerConfiguration({
    CODESHIFT_RUNNER_ID: "runner-linux-1",
    CODESHIFT_CONTROL_PLANE_URL: "https://codeshift.example",
    CODESHIFT_RUNNER_LABELS: "linux,x64",
    CODESHIFT_RUNNER_RUNTIMES: "node20,dotnet8",
    CODESHIFT_RUNNER_CAPACITY: "2",
  });
  const manifest = runnerPackageManifest(configuration);
  assert.equal(manifest.capacity, 2);
  assert.equal(manifest.isolation.persistRepository, false);
  assert.equal(manifest.isolation.network, "DENY");
});

test("runner package rejects insecure remote control planes", () => {
  assert.throws(() => resolveRunnerConfiguration({
    CODESHIFT_RUNNER_ID: "runner-1",
    CODESHIFT_CONTROL_PLANE_URL: "http://example.com",
  }), /must use HTTPS/);
});
