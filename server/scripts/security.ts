import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { chileDay } from '../src/modules/reports/report.service.js';
const app = await buildApp();
await app.ready();
const run = `SECURITY-${Date.now()}`;
const users: string[] = [];
let assertions = 0;
async function req(token: string | undefined, method: 'GET' | 'POST' | 'PUT' | 'PATCH', path: string, payload?: object, expected = 200) {
  const r = await app.inject({ method, url: `/api/v1${path}`, headers: token ? { authorization: `Bearer ${token}` } : {}, payload });
  assert.equal(r.statusCode, expected, `${method} ${path}: ${r.body}`); assertions++;
  return r.json();
}
try {
  const preflight = await app.inject({ method: 'OPTIONS', url: '/api/v1/variant-prices', headers: {
    origin: 'http://localhost:8080', 'access-control-request-method': 'PUT',
    'access-control-request-headers': 'authorization,content-type',
  } });
  assert.equal(preflight.statusCode, 204);
  assert.match(String(preflight.headers['access-control-allow-methods']), /PUT/);
  assert.match(String(preflight.headers['access-control-allow-methods']), /PATCH/);
  const untrusted = await app.inject({ method: 'OPTIONS', url: '/api/v1/variant-prices', headers: {
    origin: 'https://untrusted.example', 'access-control-request-method': 'PUT',
  } });
  assert.equal(untrusted.headers['access-control-allow-origin'], undefined);
  assertions += 4;
  const seed = await app.prisma.user.findUniqueOrThrow({ where: { email: 'admin@retailflow.local' } });
  const company = await app.prisma.company.findFirstOrThrow();
  const a = await app.prisma.branch.create({ data: { companyId: company.id, name: `${run}-A`, address: 'Pruebas' } });
  const b = await app.prisma.branch.create({ data: { companyId: company.id, name: `${run}-B`, address: 'Pruebas' } });
  async function actor(role: 'ADMIN' | 'MANAGER' | 'CASHIER', branchId: string) {
    const user = await app.prisma.user.create({ data: { name: run, rut: run, email: `${run}-${role}-${branchId}@test.local`, role,
      passwordHash: seed.passwordHash, branches: { create: { branchId } } } });
    users.push(user.id);
    return { user, token: app.jwt.sign({ sub: user.id, role, email: user.email, name: user.name, rut: user.rut, branchIds: [branchId] }) };
  }
  const admin = await actor('ADMIN', a.id), manager = await actor('MANAGER', a.id), cashier = await actor('CASHIER', a.id), foreign = await actor('MANAGER', b.id);
  await req(undefined, 'GET', '/users', undefined, 401);
  for (const path of ['/users', '/audit-logs', `/purchases?branchId=${a.id}`, `/reports/sales?branchId=${a.id}&from=2026-09-13&to=2026-09-13`]) {
    await req(cashier.token, 'GET', path, undefined, 403);
  }
  await req(manager.token, 'GET', '/users', undefined, 403);
  await req(manager.token, 'GET', '/audit-logs', undefined, 403);
  await req(foreign.token, 'GET', `/stock?branchId=${a.id}`, undefined, 403);
  assert.deepEqual((await req(cashier.token, 'GET', '/branches')).map((v: { id: string }) => v.id), [a.id]);
  const register = await app.prisma.cashRegister.create({ data: { branchId: a.id, name: run, code: run } });
  const session = await req(admin.token, 'POST', '/cash-sessions', { cashRegisterId: register.id, initialFund: 1000 }, 201);
  await req(cashier.token, 'POST', `/cash-sessions/${session.id}/close`, { declaredCash: 1000 }, 403);
  const variant = await req(admin.token, 'POST', '/products/quick', { mode: 'NEW_PRODUCT', productName: run, sku: run, salePrice: 1190 }, 201);
  const normal = (await req(admin.token, 'GET', '/price-lists')).find((p: { type: string }) => p.type === 'NORMAL');
  await req(cashier.token, 'PUT', '/variant-prices', { variantId: variant.id, priceListId: normal.id, price: 1 }, 403);
  await req(manager.token, 'PUT', '/variant-prices', { variantId: variant.id, priceListId: normal.id, price: 1190 });
  const supplier = await app.prisma.supplier.findFirstOrThrow();
  const purchase = await req(admin.token, 'POST', '/purchases', { branchId: a.id, supplierId: supplier.id, invoiceNumber: run, invoiceDate: '2026-09-13', lines: [{ variantId: variant.id, quantity: 10, unitCost: 500 }] }, 201);
  await req(foreign.token, 'GET', `/purchases/${purchase.id}/lines`, undefined, 403);
  await req(foreign.token, 'PATCH', `/purchases/${purchase.id}`, { notes: 'Forbidden' }, 403);
  const payload = { branchId: a.id, sessionId: session.id, customerId: null, docType: 'BOLETA',
    lines: [{ variantId: variant.id, variantGroupId: variant.variantGroupId, quantity: 2, unitPrice: 1190, subtotal: 2380, priceSource: 'NORMAL' }], payments: [{ method: 'CASH', amount: 2380 }] };
  await req(admin.token, 'POST', '/sales', { ...payload, lines: [{ ...payload.lines[0], subtotal: 1 }], payments: [{ method: 'CASH', amount: 1 }] }, 409);
  const sale = await req(admin.token, 'POST', '/sales', payload, 201);
  await req(cashier.token, 'POST', `/sales/${sale.document.id}/void`, { reason: run }, 403);
  await req(foreign.token, 'GET', `/sales/${sale.document.id}`, undefined, 403);
  const credit = { originalSaleId: sale.document.id, refType: 'DEVOLUCION_PARCIAL', lines: [{ variantId: variant.id, quantity: 2 }], refundMethod: 'CASH' };
  const concurrent = await Promise.all([1, 2].map(() => app.inject({ method: 'POST', url: '/api/v1/sales/credit-notes', headers: { authorization: `Bearer ${admin.token}` }, payload: credit })));
  assert.deepEqual(concurrent.map(r => r.statusCode).sort(), [201, 409]); assertions++;
  await req(admin.token, 'POST', `/sales/${sale.document.id}/void`, { reason: run }, 409);
  const day = chileDay(new Date());
  const report = await req(admin.token, 'GET', `/reports/sales?branchId=${a.id}&from=${day}&to=${day}`);
  assert.equal(report.grossSales, 2380); assert.equal(report.refunds, 2380); assert.equal(report.netSales, 0); assert.equal(report.byPaymentMethod.CASH, 0);
  assert.equal(report.transactions, 1); assertions += 5;
  await req(admin.token, 'GET', `/reports/sales?branchId=${a.id}&from=2026-02-30&to=2026-03-02`, undefined, 422);
  const filtered = await req(admin.token, 'GET', `/reports/sales?branchId=${a.id}&from=${day}&to=${day}&status=VOID_INTERNAL`);
  assert.equal(filtered.documents.length, 0);
  assert.equal(chileDay(new Date('2026-01-02T01:00:00Z')), '2026-01-01'); assertions++;
  const stock = await req(admin.token, 'GET', `/stock?branchId=${a.id}`);
  assert.equal(stock.find((s: { variantId: string }) => s.variantId === variant.id).quantity, 10);
  const closed = await req(admin.token, 'POST', `/cash-sessions/${session.id}/close`, { declaredCash: 1000 });
  assert.equal(closed.difference, 0);
  const audit = await req(admin.token, 'GET', `/audit-logs?entityType=PurchaseInvoice&entityId=${purchase.id}`);
  assert.equal(audit.length, 1); assert.equal(audit[0].action, 'CREATE_PURCHASE');
  await app.prisma.user.update({ where: { id: manager.user.id }, data: { role: 'CASHIER' } });
  await req(manager.token, 'GET', `/purchases?branchId=${a.id}`, undefined, 403);
  await app.prisma.user.update({ where: { id: cashier.user.id }, data: { isActive: false } });
  await req(cashier.token, 'GET', '/branches', undefined, 401);
  for (let i = 0; i < 11; i++) {
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: '127.0.0.9', payload: { email: 'nobody@test.local', password: 'wrong' } });
    assert.equal(r.statusCode, i < 10 ? 401 : 429);
  }
  console.log(`SECURITY OK: ${assertions} checks plus rate limiting, totals, audit and concurrent refunds.`);
} finally {
  await app.prisma.user.updateMany({ where: { id: { in: users } }, data: { isActive: false } });
  await app.close();
}
