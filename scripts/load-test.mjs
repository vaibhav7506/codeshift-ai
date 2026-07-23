import { performance } from "node:perf_hooks";
import process from "node:process";

const target = process.env.CODESHIFT_LOAD_TEST_URL ?? "http://localhost:3000/api/v1/health/live";
const requests = Number(process.env.CODESHIFT_LOAD_TEST_REQUESTS ?? "100");
const concurrency = Number(process.env.CODESHIFT_LOAD_TEST_CONCURRENCY ?? "10");
if (!Number.isInteger(requests) || requests < 1 || requests > 10_000) throw new Error("Invalid request count.");
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 100) throw new Error("Invalid concurrency.");

let next = 0;
let failures = 0;
const durations = [];
async function worker() {
  while (next < requests) {
    next += 1;
    const started = performance.now();
    try {
      const response = await globalThis.fetch(target, { signal: globalThis.AbortSignal.timeout(10_000) });
      if (!response.ok) failures += 1;
    } catch {
      failures += 1;
    }
    durations.push(performance.now() - started);
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));
durations.sort((a, b) => a - b);
const p95 = durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))];
process.stdout.write(JSON.stringify({ target, requests, concurrency, failures, p95Ms: Math.round(p95) }, null, 2) + "\n");
if (failures > 0) process.exitCode = 1;
