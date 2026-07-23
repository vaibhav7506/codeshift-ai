#!/usr/bin/env node

import { defaultRunnerIsolationPolicy } from "@codeshift/platform/enterprise-runtime";

export interface RunnerConfiguration {
  id: string;
  controlPlaneUrl: string;
  labels: string[];
  runtimes: string[];
  capacity: number;
  workDirectory: string;
}

export function resolveRunnerConfiguration(
  environment: NodeJS.ProcessEnv,
): RunnerConfiguration {
  const id = required(environment.CODESHIFT_RUNNER_ID, "CODESHIFT_RUNNER_ID");
  const controlPlaneUrl = required(
    environment.CODESHIFT_CONTROL_PLANE_URL,
    "CODESHIFT_CONTROL_PLANE_URL",
  );
  const url = new URL(controlPlaneUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("Runner control plane must use HTTPS outside localhost.");
  }
  const capacity = Number(environment.CODESHIFT_RUNNER_CAPACITY ?? "1");
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 32) {
    throw new Error("Runner capacity must be an integer between 1 and 32.");
  }
  return {
    id,
    controlPlaneUrl,
    labels: list(environment.CODESHIFT_RUNNER_LABELS),
    runtimes: list(environment.CODESHIFT_RUNNER_RUNTIMES ?? "node20"),
    capacity,
    workDirectory: environment.CODESHIFT_RUNNER_WORK_DIRECTORY ?? ".codeshift-runner/jobs",
  };
}

export function runnerPackageManifest(configuration: RunnerConfiguration) {
  return {
    identity: configuration.id,
    controlPlaneUrl: configuration.controlPlaneUrl,
    labels: configuration.labels,
    runtimes: configuration.runtimes,
    capacity: configuration.capacity,
    isolation: defaultRunnerIsolationPolicy,
    limitations: [
      "An OS/container sandbox adapter must enforce this manifest.",
      "Repository workspaces must be deleted after every job.",
    ],
  };
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim() || value.length > 300) throw new Error(`${name} is required.`);
  return value;
}

function list(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20);
}

if (process.argv[1]?.endsWith("index.js")) {
  try {
    const configuration = resolveRunnerConfiguration(process.env);
    process.stdout.write(`${JSON.stringify(runnerPackageManifest(configuration), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Runner configuration failed."}\n`);
    process.exitCode = 1;
  }
}
