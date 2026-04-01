import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const nodeCommand = process.execPath;
const viteCliPath = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));

run(nodeCommand, ["scripts/check-production-config.mjs"]);
run(nodeCommand, [viteCliPath, "build"]);
