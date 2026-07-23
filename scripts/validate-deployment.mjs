import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { URL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const directory = resolve(root, "config", "environments");
const expected = ["development.json", "production.json", "staging.json", "test.json"];
const files = (await readdir(directory)).sort();
if (JSON.stringify(files) !== JSON.stringify(expected)) {
  throw new Error("Deployment configurations are missing or unexpectedly named.");
}

for (const file of files) {
  const config = JSON.parse(await readFile(resolve(directory, file), "utf8"));
  if (config.environment !== file.replace(".json", "")) throw new Error(`${file} environment mismatch.`);
  const url = new URL(config.publicBaseUrl);
  if (["staging", "production"].includes(config.environment)) {
    if (url.protocol !== "https:") throw new Error(`${file} must use HTTPS.`);
    if (config.persistence !== "postgres") throw new Error(`${file} requires durable PostgreSQL.`);
    for (const key of ["databaseUrl", "encryptionKey", "identitySecret", "githubWebhookSecret"]) {
      if (!/^\$\{[A-Z0-9_]+\}$/.test(config[key] ?? "")) {
        throw new Error(`${file} must obtain ${key} from a secret environment variable.`);
      }
    }
  }
  for (const key of ["logRetentionDays", "auditRetentionDays", "objectStorageLifecycleDays"]) {
    if (!Number.isInteger(config[key]) || config[key] < 1) throw new Error(`${file} has invalid ${key}.`);
  }
}

process.stdout.write(`Validated ${files.length} deployment environment configurations.\n`);
