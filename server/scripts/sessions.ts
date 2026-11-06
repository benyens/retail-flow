import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
const app = await buildApp();
await app.ready();
try {
  const login = async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@retailflow.local', password: 'admin1234' } });
    assert.equal(response.statusCode, 200);
    return response.json().token as string;
  };
  const first = await login(), second = await login();
  assert.notEqual(first, second, 'Separate logins must have independent tokens');
  const request = (token: string, method: 'GET' | 'POST', path: string) => app.inject({ method, url: `/api/v1${path}`, headers: { authorization: `Bearer ${token}` } });
  assert.equal((await request(first, 'GET', '/branches')).statusCode, 200);
  assert.equal((await request(first, 'POST', '/auth/logout')).statusCode, 200);
  assert.equal((await request(first, 'GET', '/branches')).statusCode, 401);
  assert.equal((await request(second, 'GET', '/branches')).statusCode, 200);
  assert.equal((await request(first, 'POST', '/auth/logout')).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/api/v1/auth/logout' })).statusCode, 401);
  // A second app instance must see the same persisted revocation.
  const other = await buildApp();
  try {
    const response = await other.inject({ method: 'GET', url: '/api/v1/branches', headers: { authorization: `Bearer ${first}` } });
    assert.equal(response.statusCode, 401);
  } finally { await other.close(); }
  // Renovación: token nuevo con authTime conservado; el revocado no puede renovar;
  // pasado el tope desde el login original se exige la contraseña.
  const refreshed = await request(second, 'POST', '/auth/refresh');
  assert.equal(refreshed.statusCode, 200);
  const renewed = refreshed.json().token as string;
  assert.notEqual(renewed, second);
  const claims = (t: string) => app.jwt.decode<{ authTime: number; role: string }>(t)!;
  assert.equal(claims(renewed).authTime, claims(second).authTime);
  assert.equal(refreshed.json().user.role, 'ADMIN');
  assert.equal((await request(renewed, 'GET', '/branches')).statusCode, 200);
  assert.equal((await request(first, 'POST', '/auth/refresh')).statusCode, 401);
  const old = claims(second);
  const stale = app.jwt.sign({ ...old, jti: 'stale-session', authTime: Math.floor(Date.now() / 1000) - 8 * 24 * 3600 } as never, { expiresIn: '1h' });
  const tooOld = await request(stale, 'POST', '/auth/refresh');
  assert.equal(tooOld.statusCode, 401);
  assert.equal(tooOld.json().error, 'SESSION_TOO_OLD');
  assert.equal((await request(second, 'POST', '/auth/logout')).statusCode, 200);
  assert.equal((await request(renewed, 'POST', '/auth/logout')).statusCode, 200);
  console.log('SESSIONS OK: independent logins, revocation, cross-instance persistence and token refresh');
} finally { await app.close(); }
