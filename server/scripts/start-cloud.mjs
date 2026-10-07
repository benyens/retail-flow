import { spawnSync } from 'node:child_process';
function run(file, args) {
  const result = spawnSync(process.execPath, [file, ...args], { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run('node_modules/prisma/build/index.js', ['migrate', 'deploy']);
if (process.env.SEED_ON_START === 'true') {
  run('node_modules/tsx/dist/cli.mjs', ['prisma/seed.ts']);
}
await import('../dist/server.js');
