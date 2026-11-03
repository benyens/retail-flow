import { spawnSync } from 'node:child_process';

function fail(msg) {
  console.error(`\n[start-cloud] ${msg}\n`);
  process.exit(1);
}

export function normalizeDatabaseUrl(raw) {
  // Tolera pegar "psql 'postgresql://...'" o la URL entre comillas.
  const cleaned = raw.trim().replace(/^psql\s+/i, '').replace(/^['"]+|['"]+$/g, '').trim();
  const u = new URL(cleaned);
  if (!/^postgres(ql)?:$/.test(u.protocol)) throw new Error('protocolo inválido');
  u.searchParams.delete('channel_binding');
  if (!u.searchParams.has('sslmode')) u.searchParams.set('sslmode', 'require');
  if (!u.searchParams.has('connect_timeout')) u.searchParams.set('connect_timeout', '30');
  return u;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const key of ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGINS']) {
    if (!process.env[key]?.trim()) fail(`Falta la variable ${key}. Defínela en Render > Environment.`);
  }

  try {
    const url = normalizeDatabaseUrl(process.env.DATABASE_URL);
    if (url.hostname.includes('-pooler')) {
      fail('DATABASE_URL usa el host "-pooler" de Neon. Para migrar usa la conexión directa (en Connect, desactiva "Connection pooling").');
    }
    process.env.DATABASE_URL = url.toString();
  } catch {
    fail('DATABASE_URL no es válida: debe ser la URL completa postgresql://... de Neon (sin espacios).');
  }

  function run(file, args) {
    const result = spawnSync(process.execPath, [file, ...args], { stdio: 'inherit', env: process.env });
    if (result.error) throw result.error;
    return result.status ?? 1;
  }

  // Neon Free se suspende por inactividad: la primera conexión puede fallar mientras despierta.
  const attempts = 6;
  let migrated = false;
  for (let i = 1; i <= attempts && !migrated; i++) {
    console.log(`[start-cloud] prisma migrate deploy (intento ${i}/${attempts})`);
    migrated = run('node_modules/prisma/build/index.js', ['migrate', 'deploy']) === 0;
    if (!migrated && i < attempts) {
      console.log('[start-cloud] Fallo (¿Neon despertando?). Reintentando en 10 s...');
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
  if (!migrated) fail('migrate deploy falló tras varios intentos. Revisa DATABASE_URL (conexión directa, sslmode=require).');

  if (process.env.SEED_ON_START === 'true') {
    if (run('node_modules/tsx/dist/cli.mjs', ['prisma/seed.ts']) !== 0) fail('El seed falló. Revisa SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD (mínimo 16 caracteres).');
  }

  await import('../dist/server.js');
}
