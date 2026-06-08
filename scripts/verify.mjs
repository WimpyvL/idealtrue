import { spawnSync } from 'node:child_process';

function run(script) {
  const command = `npm run ${script}`;
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
        stdio: 'inherit',
      })
    : spawnSync(command, {
        stdio: 'inherit',
        shell: true,
      });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('check:drift');
run('lint');
run('test');
run('build');
