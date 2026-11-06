import { CashService } from '../cash/cash.service.js';
import type { PrismaClient, DocumentType, DocumentStatus, Prisma } from '@prisma/client';

export const chileDay = (date: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

/**
 * Primer instante (UTC) del día `YYYY-MM-DD` en horario de Chile. Se busca hora a hora
 * porque el desfase cambia (UTC-3 / UTC-4) y en el cambio de hora la medianoche puede
 * no existir; así el filtro se hace en la base sin traer filas de más.
 */
export function chileDayStart(day: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  for (let h = 0; h <= 8; h++) {
    const candidate = new Date(Date.UTC(y, m - 1, d, h));
    if (chileDay(candidate) === day && chileDay(new Date(candidate.getTime() - 1)) < day) return candidate;
  }
  throw new Error(`No se pudo calcular el inicio del día ${day}`);
}

export function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

type SalesFilters = {
  from: string; to: string; docType?: DocumentType; status?: DocumentStatus; query?: string;
  offset?: number; limit?: number;
};

export class ReportService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Totales calculados en la base sobre todo el período; `documents` es solo la página
   * pedida (offset/limit) y `totalDocuments` el total que cumple los filtros.
   */
  async getSalesReport(branchId: string, filters: SalesFilters) {
    const where: Prisma.SalesDocumentWhereInput = {
      branchId, docType: filters.docType, status: filters.status,
      createdAt: { gte: chileDayStart(filters.from), lt: chileDayStart(nextDay(filters.to)) },
      ...(filters.query ? { OR: [
        { folio: { contains: filters.query, mode: 'insensitive' } },
        { customer: { name: { contains: filters.query, mode: 'insensitive' } } },
        { customer: { rut: { contains: filters.query, mode: 'insensitive' } } },
      ] } : {}),
    };
    // Los totales solo consideran documentos emitidos (dentro de los filtros aplicados).
    const issued: Prisma.SalesDocumentWhereInput = { AND: [where, { status: 'ISSUED' }] };
    const [totalDocuments, rows, byType, paymentsByMethod] = await Promise.all([
      this.prisma.salesDocument.count({ where }),
      this.prisma.salesDocument.findMany({
        where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: filters.offset ?? 0, take: filters.limit ?? 25,
      }),
      this.prisma.salesDocument.groupBy({ by: ['docType'], where: issued, _sum: { total: true }, _count: { _all: true } }),
      this.prisma.payment.groupBy({
        by: ['method'], where: { salesDocument: { AND: [issued, { docType: { not: 'CREDIT_NOTE' } }] } }, _sum: { amount: true },
      }),
    ]);
    const refundsByMethod = await this.prisma.payment.groupBy({
      by: ['method'], where: { salesDocument: { AND: [issued, { docType: 'CREDIT_NOTE' }] } }, _sum: { amount: true },
    });
    let grossSales = 0, refunds = 0, transactions = 0;
    const byDocType = { BOLETA: 0, FACTURA: 0, CREDIT_NOTE: 0 };
    for (const t of byType) {
      const total = Number(t._sum.total ?? 0);
      if (t.docType === 'CREDIT_NOTE') { refunds += total; byDocType.CREDIT_NOTE -= total; }
      else { grossSales += total; transactions += t._count._all; byDocType[t.docType] += total; }
    }
    const byPaymentMethod = { CASH: 0, CARD: 0, TRANSFER: 0, CHECK: 0, OTHER: 0 };
    for (const p of paymentsByMethod) byPaymentMethod[p.method] += Number(p._sum.amount ?? 0);
    for (const p of refundsByMethod) byPaymentMethod[p.method] -= Number(p._sum.amount ?? 0);
    return { grossSales, refunds, netSales: grossSales - refunds, transactions, byPaymentMethod, byDocType, totalDocuments,
      documents: rows.map(d => ({
        id: d.id, branchId: d.branchId, cashSessionId: d.cashSessionId,
        customerId: d.customerId ?? undefined, docType: d.docType, status: d.status,
        folio: d.folio ?? undefined, subtotal: Number(d.subtotal), tax: Number(d.tax), total: Number(d.total),
        createdAt: d.createdAt.toISOString(), createdBy: d.createdBy,
      })),
    };
  }

  /**
   * Resumen para la pantalla de inicio: hoy vs. ayer, últimos 7 días (horario de Chile),
   * más vendidos de la semana, cajas abiertas y productos por reponer.
   */
  async getDashboard(branch: string | string[], now = new Date()) {
    const branchIds = Array.isArray(branch) ? branch : [branch];
    const today = chileDay(now);
    const days: string[] = [];
    for (let d = new Date(`${today}T12:00:00Z`), i = 0; i < 7; i++, d.setUTCDate(d.getUTCDate() - 1)) days.unshift(d.toISOString().slice(0, 10));
    const start = chileDayStart(days[0]!), end = chileDayStart(nextDay(today));
    const issued = { branchId: { in: branchIds }, status: 'ISSUED' as const, createdAt: { gte: start, lt: end } };

    const [docs, top, openSessions, stocks] = await Promise.all([
      this.prisma.salesDocument.findMany({ where: issued, select: { createdAt: true, total: true, docType: true } }),
      this.prisma.salesLine.groupBy({
        by: ['variantId'], where: { salesDocument: { ...issued, docType: { not: 'CREDIT_NOTE' } } },
        _sum: { quantity: true, subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } }, take: 5,
      }),
      new CashService(this.prisma).listOpenSessions(branchIds),
      this.prisma.stock.findMany({
        where: { branchId: { in: branchIds }, minQuantity: { not: null }, variant: { isActive: true } },
        select: { branchId: true, branch: { select: { name: true } }, variantId: true, quantity: true, minQuantity: true, variant: { select: { name: true, sku: true, product: { select: { name: true } } } } },
      }),
    ]);

    const byDay = new Map(days.map(d => [d, { day: d, net: 0, transactions: 0 }]));
    for (const doc of docs) {
      const bucket = byDay.get(chileDay(doc.createdAt));
      if (!bucket) continue;
      if (doc.docType === 'CREDIT_NOTE') bucket.net -= Number(doc.total);
      else { bucket.net += Number(doc.total); bucket.transactions++; }
    }
    const series = [...byDay.values()];
    const names = await this.prisma.variant.findMany({
      where: { id: { in: top.map(t => t.variantId) } }, select: { id: true, name: true, product: { select: { name: true } } },
    });
    const label = (product: string, variant: string) => (variant && variant !== 'Única' ? `${product} · ${variant}` : product);
    const lowStock = stocks
      .filter(s => Number(s.quantity) <= Number(s.minQuantity))
      .map(s => ({ branchId: s.branchId, branchName: s.branch.name, variantId: s.variantId, name: label(s.variant.product.name, s.variant.name), sku: s.variant.sku,
        quantity: Number(s.quantity), minQuantity: Number(s.minQuantity) }))
      .sort((a, b) => (a.quantity - a.minQuantity) - (b.quantity - b.minQuantity));

    return {
      today: series[6]!, yesterday: series[5]!, last7Days: series,
      weekNet: series.reduce((sum, d) => sum + d.net, 0),
      topProducts: top.map(t => {
        const v = names.find(n => n.id === t.variantId);
        return { variantId: t.variantId, name: v ? label(v.product.name, v.name) : t.variantId,
          quantity: Number(t._sum.quantity ?? 0), total: Number(t._sum.subtotal ?? 0) };
      }),
      openSessions,
      lowStock: lowStock.slice(0, 10), lowStockCount: lowStock.length,
    };
  }

  /**
   * Vista de todas las sucursales del usuario: el mismo resumen sumado y una fila
   * por sucursal (hoy, 7 días, cajas abiertas, por reponer) para comparar.
   */
  async getOverview(branchIds: string[], now = new Date()) {
    const totals = await this.getDashboard(branchIds, now);
    const branches = await this.prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
    const today = chileDay(now);
    const todayStart = chileDayStart(today), todayEnd = chileDayStart(nextDay(today));
    const weekStart = chileDayStart(totals.last7Days[0]!.day);
    const sums = (from: Date) => this.prisma.salesDocument.groupBy({
      by: ['branchId', 'docType'], where: { branchId: { in: branchIds }, status: 'ISSUED', createdAt: { gte: from, lt: todayEnd } },
      _sum: { total: true }, _count: { _all: true },
    });
    const [todayRows, weekRows] = await Promise.all([sums(todayStart), sums(weekStart)]);
    const net = (rows: typeof todayRows, id: string) => rows.filter(r => r.branchId === id)
      .reduce((n, r) => n + (r.docType === 'CREDIT_NOTE' ? -1 : 1) * Number(r._sum.total ?? 0), 0);
    const count = (rows: typeof todayRows, id: string) => rows.filter(r => r.branchId === id && r.docType !== 'CREDIT_NOTE')
      .reduce((n, r) => n + r._count._all, 0);
    // lowStock del resumen viene recortado a 10; el conteo por sucursal se hace aparte.
    const lowByBranch = await this.prisma.$queryRaw<{ branchId: string; n: bigint }[]>`
      SELECT s."branchId", COUNT(*)::bigint AS n FROM stocks s JOIN variants v ON v.id = s."variantId"
      WHERE s."branchId" = ANY(${branchIds}) AND s."minQuantity" IS NOT NULL AND s.quantity <= s."minQuantity" AND v."isActive"
      GROUP BY s."branchId"`;
    return {
      ...totals,
      branches: branches.map(b => ({
        branchId: b.id, name: b.name,
        todayNet: net(todayRows, b.id), todayTransactions: count(todayRows, b.id), weekNet: net(weekRows, b.id),
        openRegisters: totals.openSessions.filter(s => s.branchId === b.id).length,
        lowStockCount: Number(lowByBranch.find(l => l.branchId === b.id)?.n ?? 0),
      })),
    };
  }

  async getDailySalesReport(branchId: string, date: string) {
    const report = await this.getSalesReport(branchId, { from: date, to: date, limit: 0 });
    return { date, branchId, totalSales: report.netSales, totalTransactions: report.transactions,
      byPaymentMethod: report.byPaymentMethod, byDocType: report.byDocType };
  }
}
