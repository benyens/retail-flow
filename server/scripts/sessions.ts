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
  assert.equal((await request(second, 'POST', '/auth/logout')).statusCode, 200);
  console.log('SESSIONS OK: independent logins, revoked-token rejection and cross-instance persistence');
} finally { await app.close(); }
