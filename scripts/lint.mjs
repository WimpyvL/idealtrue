import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const nodeCommand = process.execPath;
const tscCliPath = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
const eslintCliPath = fileURLToPath(new URL('../node_modules/eslint/bin/eslint.js', import.meta.url));

run(nodeCommand, [tscCliPath, '--noEmit']);
run(nodeCommand, [tscCliPath, '--noEmit', '-p', 'encore/tsconfig.json']);
run(nodeCommand, [eslintCliPath, '.', '--max-warnings=0']);
