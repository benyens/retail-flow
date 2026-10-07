import type { PrismaClient, DocumentType, DocumentStatus } from '@prisma/client';

export const chileDay = (date: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

export class ReportService {
  constructor(private readonly prisma: PrismaClient) {}

  async getSalesReport(branchId: string, filters: { from: string; to: string; docType?: DocumentType; status?: DocumentStatus; query?: string }) {
    const end = new Date(`${filters.to}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 2);
    const rows = await this.prisma.salesDocument.findMany({
      where: { branchId, docType: filters.docType, status: filters.status,
        createdAt: { gte: new Date(`${filters.from}T00:00:00Z`), lt: end },
        ...(filters.query ? { OR: [
          { folio: { contains: filters.query, mode: 'insensitive' } },
          { customer: { name: { contains: filters.query, mode: 'insensitive' } } },
          { customer: { rut: { contains: filters.query, mode: 'insensitive' } } },
        ] } : {}),
      }, include: { payments: true }, orderBy: { createdAt: 'desc' },
    });
    const documents = rows.filter(d => {
      const day = chileDay(d.createdAt);
      return day >= filters.from && day <= filters.to;
    });
    let grossSales = 0, refunds = 0, transactions = 0;
    const byPaymentMethod = { CASH: 0, CARD: 0, TRANSFER: 0, CHECK: 0, OTHER: 0 };
    for (const doc of documents) {
      if (doc.status !== 'ISSUED') continue;
      const sign = doc.docType === 'CREDIT_NOTE' ? -1 : 1;
      if (sign < 0) refunds += Number(doc.total);
      else { grossSales += Number(doc.total); transactions++; }
      for (const p of doc.payments) byPaymentMethod[p.method] += sign * Number(p.amount);
    }
    return { grossSales, refunds, netSales: grossSales - refunds, transactions, byPaymentMethod,
      documents: documents.map(d => ({
        id: d.id, branchId: d.branchId, cashSessionId: d.cashSessionId,
        customerId: d.customerId ?? undefined, docType: d.docType, status: d.status,
        folio: d.folio ?? undefined, subtotal: Number(d.subtotal), tax: Number(d.tax), total: Number(d.total),
        createdAt: d.createdAt.toISOString(), createdBy: d.createdBy,
      })),
    };
  }

  async getDailySalesReport(branchId: string, date: string) {
    const report = await this.getSalesReport(branchId, { from: date, to: date });
    const byDocType = { BOLETA: 0, FACTURA: 0, CREDIT_NOTE: 0 };
    for (const d of report.documents) if (d.status === 'ISSUED') {
      byDocType[d.docType] += (d.docType === 'CREDIT_NOTE' ? -1 : 1) * d.total;
    }
    return { date, branchId, totalSales: report.netSales, totalTransactions: report.transactions,
      byPaymentMethod: report.byPaymentMethod, byDocType };
  }
}
