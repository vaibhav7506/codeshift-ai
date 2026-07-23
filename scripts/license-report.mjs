import { execFileSync } from "node:child_process";
import process from "node:process";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this script through npm run license:report.");
const packages = JSON.parse(execFileSync(process.execPath, [npmCli, "query", "*"], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
}));
const report = packages
  .map((entry) => ({
    name: entry.name,
    version: entry.version,
    license: entry.license ?? "UNKNOWN",
    location: entry.location,
  }))
  .sort((left, right) => `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`));
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
