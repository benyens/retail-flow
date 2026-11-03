import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

// Run only against a seeded development database. Records are retained for inspection.
const app = await buildApp();
let token = '';
async function request(method: 'GET' | 'POST', path: string, payload?: object, expected = 200) {
  const response = await app.inject({ method, url: `/api/v1${path}`,
    headers: token ? { authorization: `Bearer ${token}` } : {}, payload });
  assert.equal(response.statusCode, expected, `${method} ${path}: ${response.body}`);
  return response.json();
}
try {
  const login = await request('POST', '/auth/login', {
    email: 'admin@retailflow.local', password: 'admin1234',
  });
  token = login.token;
  const branchId = login.user.branchIds[0];
  const run = Date.now().toString();
  const register = await app.prisma.cashRegister.create({ data: {
    branchId, name: `Smoke ${run}`, code: `SMOKE-${run}`,
  } });
  const session = await request('POST', '/cash-sessions', {
    cashRegisterId: register.id, initialFund: 10000,
  }, 201);
  const variant = await request('POST', '/products/quick', {
    mode: 'NEW_PRODUCT', productName: `Smoke ${run}`, sku: `SMOKE-${run}`, salePrice: 1190,
  }, 201);
  const suppliers = await request('GET', '/suppliers');
  const purchase = await request('POST', '/purchases', {
    branchId, supplierId: suppliers[0].id, invoiceNumber: `SMOKE-${run}`,
    invoiceDate: new Date().toISOString(), notes: 'Validación de desarrollo',
    lines: [{ variantId: variant.id, quantity: 10, unitCost: 500 }],
  }, 201);
  assert.equal(purchase.total, 5950);
  const sale = await request('POST', '/sales', {
    branchId, sessionId: session.id, customerId: null, docType: 'BOLETA',
    lines: [{ variantId: variant.id, variantGroupId: variant.variantGroupId,
      quantity: 2, unitPrice: 1190, priceSource: 'NORMAL', subtotal: 2380 }],
    payments: [{ method: 'CASH', amount: 2380 }],
  }, 201);
  assert.equal(sale.document.total, 2380);
  assert.equal(sale.document.tax, 380);
  assert.equal(sale.dteRequest.providerName, 'INTERNAL_STUB');
  let stocks = await request('GET', `/stock?branchId=${branchId}`);
  assert.equal(stocks.find((s: { variantId: string }) => s.variantId === variant.id).quantity, 8);
  await request('POST', '/sales/credit-notes', {
    originalSaleId: sale.document.id, refType: 'DEVOLUCION_PARCIAL',
    lines: [{ variantId: variant.id, quantity: 1 }], refundMethod: 'CASH',
  }, 201);
  stocks = await request('GET', `/stock?branchId=${branchId}`);
  assert.equal(stocks.find((s: { variantId: string }) => s.variantId === variant.id).quantity, 9);
  const closed = await request('POST', `/cash-sessions/${session.id}/close`, { declaredCash: 11190 });
  assert.equal(closed.expectedCash, 11190);
  assert.equal(closed.difference, 0);
  await request('POST', '/auth/logout');
  console.log('SMOKE OK: login, catálogo, compra, venta, devolución, stock y cierre de caja.');
} finally {
  await app.close();
}
