import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import process from "node:process";

const patterns = [
  ["GitHub token", /(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}/g],
  ["OpenAI-style key", /sk-[A-Za-z0-9]{24,}/g],
  ["AWS access key", /AKIA[0-9A-Z]{16}/g],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
];
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => file !== "package-lock.json");
const findings = [];
let scanned = 0;
for (const file of new Set(files)) {
  const stat = statSync(file, { throwIfNoEntry: false });
  if (!stat?.isFile() || stat.size > 2 * 1024 * 1024) continue;
  scanned += 1;
  const content = readFileSync(file, "utf8");
  for (const [name, pattern] of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) findings.push(`${name}: ${file}`);
  }
}
if (findings.length > 0) {
  process.stderr.write(`${findings.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Scanned ${scanned} working-tree files; no high-confidence secrets found.\n`);
}
