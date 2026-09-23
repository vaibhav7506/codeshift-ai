import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const standaloneWebRoot = join(
  webRoot,
  ".next",
  "standalone",
  "apps",
  "web",
);

copyDirectory(
  join(webRoot, ".next", "static"),
  join(standaloneWebRoot, ".next", "static"),
);
copyDirectory(join(webRoot, "public"), join(standaloneWebRoot, "public"));

function copyDirectory(source, destination) {
  if (!existsSync(source)) return;
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true, force: true });
}
