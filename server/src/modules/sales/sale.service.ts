import type { PrismaClient } from "@prisma/client";
import { AuditService } from "../reports/audit.service.js";

export class SaleConflictError extends Error {
  readonly statusCode = 409;
}
export class InsufficientStockError extends Error {
  readonly statusCode = 409;
}

interface SaleLineInput {
  variantId: string;
  variantGroupId: string;
  quantity: number;
  unitPrice: number;
  priceSource: "NORMAL" | "WHOLESALE" | "MANUAL";
  wholesaleMinQtyApplied?: number;
  wholesaleUnitPriceApplied?: number;
  subtotal: number;
}

interface PaymentInput {
  method: "CASH" | "CARD" | "TRANSFER" | "CHECK" | "OTHER";
  amount: number;
  reference?: string;
}

const IVA_RATE = 0.19;

function toSalesDocumentDTO(doc: {
  id: string; branchId: string; cashSessionId: string; customerId: string | null; docType: string;
  status: string; folio: string | null; subtotal: unknown; tax: unknown; total: unknown;
  createdAt: Date; createdBy: string;
}) {
  return {
    id: doc.id, branchId: doc.branchId, cashSessionId: doc.cashSessionId, customerId: doc.customerId ?? undefined,
    docType: doc.docType, status: doc.status, folio: doc.folio ?? undefined,
    subtotal: Number(doc.subtotal), tax: Number(doc.tax), total: Number(doc.total),
    createdAt: doc.createdAt.toISOString(), createdBy: doc.createdBy,
  };
}

function toSalesLineDTO(line: {
  id: string; salesDocumentId: string; variantId: string; variantGroupId: string; quantity: unknown;
  unitPrice: unknown; priceSource: string; wholesaleMinQtyApplied: number | null; wholesaleUnitPriceApplied: unknown; subtotal: unknown;
}) {
  return {
    id: line.id, salesDocumentId: line.salesDocumentId, variantId: line.variantId, variantGroupId: line.variantGroupId,
    quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), priceSource: line.priceSource,
    wholesaleMinQtyApplied: line.wholesaleMinQtyApplied ?? undefined,
    wholesaleUnitPriceApplied: line.wholesaleUnitPriceApplied != null ? Number(line.wholesaleUnitPriceApplied) : undefined,
    subtotal: Number(line.subtotal),
  };
}

function toPaymentDTO(p: { id: string; salesDocumentId: string; cashSessionId: string; method: string; amount: unknown; reference: string | null; createdAt: Date }) {
  return {
    id: p.id, salesDocumentId: p.salesDocumentId, cashSessionId: p.cashSessionId, method: p.method,
    amount: Number(p.amount), reference: p.reference ?? undefined, createdAt: p.createdAt.toISOString(),
  };
}

function toDteDTO(d: {
  id: string; salesDocumentId: string; status: string; providerName: string; providerExternalId: string | null;
  folio: string | null; siiTrackId: string | null; lastError: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: d.id, salesDocumentId: d.salesDocumentId, status: d.status, providerName: d.providerName,
    providerExternalId: d.providerExternalId ?? undefined, folio: d.folio ?? undefined,
    siiTrackId: d.siiTrackId ?? undefined, lastError: d.lastError ?? undefined,
    createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
  };
}

export class SaleService {
  constructor(private readonly prisma: PrismaClient) {}

  async createSale(
    branchId: string, sessionId: string, customerId: string | null, docType: "BOLETA" | "FACTURA",
    lines: SaleLineInput[], payments: PaymentInput[], createdBy: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM cash_sessions WHERE id = ${sessionId} FOR UPDATE`;
      const session = await tx.cashSession.findUnique({ where: { id: sessionId }, include: { cashRegister: true } });
      if (!session || session.status !== "OPEN") throw new SaleConflictError("La sesión de caja no existe o no está abierta");
      if (session.cashRegister.branchId !== branchId) throw new SaleConflictError("La sesión de caja no pertenece a la sucursal indicada");

      const actor = await tx.user.findUniqueOrThrow({ where: { id: createdBy } });
      if (new Set(lines.map(l => l.variantId)).size !== lines.length) throw new SaleConflictError('Combina las cantidades de cada variante en una sola línea');
      const variants = await tx.variant.findMany({ where: { id: { in: lines.map(l => l.variantId) } },
        include: { product: { include: { allowedBranches: true } }, prices: { include: { priceList: true } }, variantGroup: { include: { wholesaleTiers: true } } } });
      for (const line of lines) {
        const variant = variants.find(v => v.id === line.variantId);
        if (!variant?.isActive || !variant.product.isActive || variant.variantGroupId !== line.variantGroupId ||
          (variant.product.allowedBranches.length && !variant.product.allowedBranches.some(b => b.branchId === branchId))) {
          throw new SaleConflictError('Producto no disponible en esta sucursal o grupo inválido');
        }
        if (line.subtotal !== Math.round(line.unitPrice * line.quantity)) throw new SaleConflictError('Subtotal de línea inválido');
        if (line.priceSource === 'MANUAL') {
          if (actor.role === 'CASHIER') throw new SaleConflictError('Un precio manual requiere administrador o encargado');
        } else {
          const qty = lines.filter(l => l.variantGroupId === variant.variantGroupId).reduce((s, l) => s + l.quantity, 0);
          const tier = variant.variantGroup.wholesaleTiers.filter(t => t.minQty <= qty).sort((a, b) => b.minQty - a.minQty)[0];
          const price = tier?.unitPrice ?? variant.prices.find(p => p.priceList.type === 'NORMAL')?.price;
          if (price == null || Number(price) !== line.unitPrice || line.priceSource !== (tier ? 'WHOLESALE' : 'NORMAL')) {
            throw new SaleConflictError('El precio cambió o no coincide con la lista vigente. Actualiza el carrito');
          }
        }
      }
      const total = Math.round(lines.reduce((sum, l) => sum + l.subtotal, 0));
      const paid = Math.round(payments.reduce((sum, p) => sum + p.amount, 0));
      if (paid !== total) throw new SaleConflictError(`Los pagos (${paid}) no cuadran con el total de la venta (${total})`);

      const netSubtotal = Math.round(total / (1 + IVA_RATE));
      const tax = total - netSubtotal;

      // Descuento atómico y condicional -- ver README, sección de hardening.
      for (const line of lines) {
        const result = await tx.stock.updateMany({
          where: { branchId, variantId: line.variantId, quantity: { gte: line.quantity } },
          data: { quantity: { decrement: line.quantity } },
        });
        if (result.count === 0) {
          const stock = await tx.stock.findUnique({ where: { branchId_variantId: { branchId, variantId: line.variantId } } });
          throw new InsufficientStockError(`Stock insuficiente para variante ${line.variantId}: disponible ${Number(stock?.quantity ?? 0)}, solicitado ${line.quantity}`);
        }
      }

      const document = await tx.salesDocument.create({
        data: {
          branchId, cashSessionId: sessionId, customerId, docType, status: "PENDING_ISSUE",
          subtotal: netSubtotal, tax, total, createdBy,
          lines: {
            create: lines.map((l) => ({
              variantId: l.variantId, variantGroupId: l.variantGroupId, quantity: l.quantity, unitPrice: l.unitPrice,
              priceSource: l.priceSource, wholesaleMinQtyApplied: l.wholesaleMinQtyApplied,
              wholesaleUnitPriceApplied: l.wholesaleUnitPriceApplied, subtotal: l.subtotal,
            })),
          },
          payments: { create: payments.map((p) => ({ cashSessionId: sessionId, method: p.method, amount: p.amount, reference: p.reference })) },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          branchId, type: "SALE", referenceId: document.id, referenceType: "SalesDocument", createdBy,
          lines: {
            create: await Promise.all(lines.map(async (l) => {
              const stock = await tx.stock.findUnique({ where: { branchId_variantId: { branchId, variantId: l.variantId } } });
              const newStock = Number(stock?.quantity ?? 0);
              return { variantId: l.variantId, quantity: -l.quantity, previousStock: newStock + l.quantity, newStock };
            })),
          },
        },
      });

      const cashPaid = payments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0);
      if (cashPaid > 0) {
        await tx.cashSession.update({ where: { id: sessionId }, data: { expectedCash: { increment: cashPaid } } });
      }

      const counter = await tx.docFolioCounter.upsert({
        where: { branchId_docType: { branchId, docType } },
        create: { branchId, docType, lastFolio: 1 },
        update: { lastFolio: { increment: 1 } },
      });
      const folio = String(counter.lastFolio);

      const [updatedDocument, dte] = await Promise.all([
        tx.salesDocument.update({ where: { id: document.id }, data: { status: "ISSUED", folio } }),
        tx.dTERequest.create({ data: { salesDocumentId: document.id, status: "ACCEPTED", providerName: "INTERNAL_STUB", folio } }),
      ]);

      await AuditService.log(tx, { userId: createdBy, action: 'CREATE_SALE', entityType: 'SalesDocument', entityId: document.id,
        afterData: { branchId, total, docType, manualPrices: lines.filter(l => l.priceSource === 'MANUAL') } });

      return { document: toSalesDocumentDTO(updatedDocument), dteRequest: toDteDTO(dte) };
    });
  }

  async getSales(branchId: string, sessionId?: string) {
    const documents = await this.prisma.salesDocument.findMany({ where: { branchId, cashSessionId: sessionId }, orderBy: { createdAt: "desc" } });
    return documents.map(toSalesDocumentDTO);
  }

  async getSaleDetail(saleId: string) {
    const document = await this.prisma.salesDocument.findUniqueOrThrow({ where: { id: saleId } });
    const [lines, payments, dte] = await Promise.all([
      this.prisma.salesLine.findMany({ where: { salesDocumentId: saleId } }),
      this.prisma.payment.findMany({ where: { salesDocumentId: saleId } }),
      this.prisma.dTERequest.findUnique({ where: { salesDocumentId: saleId } }),
    ]);
    return {
      document: toSalesDocumentDTO(document), lines: lines.map(toSalesLineDTO),
      payments: payments.map(toPaymentDTO), dte: dte ? toDteDTO(dte) : null,
    };
  }

  async voidSaleInternal(saleId: string, reason: string, voidedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const original = await tx.salesDocument.findUniqueOrThrow({ where: { id: saleId } });
      await tx.$queryRaw`SELECT id FROM cash_sessions WHERE id = ${original.cashSessionId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM sales_documents WHERE id = ${saleId} FOR UPDATE`;
      const document = await tx.salesDocument.findUniqueOrThrow({ where: { id: saleId } });
      if (document.status === "VOID_INTERNAL") throw new SaleConflictError("La venta ya está anulada");
      if (document.docType === 'CREDIT_NOTE' || document.status !== 'ISSUED') throw new SaleConflictError('Solo se pueden anular ventas emitidas');
      if (await tx.salesDocumentReference.count({ where: { originalDocumentId: saleId } })) throw new SaleConflictError('La venta ya tiene notas de crédito; no se puede volver a restituir su stock');

      const lines = await tx.salesLine.findMany({ where: { salesDocumentId: saleId } });
      const payments = await tx.payment.findMany({ where: { salesDocumentId: saleId } });

      const inventoryLines = [];
      for (const line of lines) {
        const restored = await tx.stock.upsert({
          where: { branchId_variantId: { branchId: document.branchId, variantId: line.variantId } },
          create: { branchId: document.branchId, variantId: line.variantId, quantity: Number(line.quantity) },
          update: { quantity: { increment: Number(line.quantity) } },
        });
        inventoryLines.push({ variantId: line.variantId, quantity: Number(line.quantity), previousStock: Number(restored.quantity) - Number(line.quantity), newStock: Number(restored.quantity) });
      }

      await tx.inventoryMovement.create({
        data: {
          branchId: document.branchId, type: "RETURN", referenceId: document.id, referenceType: "SalesDocument",
          notes: `Anulación interna: ${reason}`, createdBy: voidedBy,
          lines: { create: inventoryLines },
        },
      });

      const cashPaid = payments.filter((p) => p.method === "CASH").reduce((s, p) => s + Number(p.amount), 0);
      const session = await tx.cashSession.findUniqueOrThrow({ where: { id: document.cashSessionId } });
      if (cashPaid > 0 && session.status === 'OPEN') {
        await tx.cashSession.update({ where: { id: document.cashSessionId }, data: { expectedCash: { decrement: cashPaid } } });
      }

      const updated = await tx.salesDocument.update({ where: { id: saleId }, data: { status: "VOID_INTERNAL" } });

      await AuditService.log(tx, {
        userId: voidedBy, action: "VOID_SALE_INTERNAL", entityType: "SalesDocument", entityId: saleId,
        beforeData: { status: document.status }, afterData: { status: "VOID_INTERNAL", reason },
      });

      return toSalesDocumentDTO(updated);
    });
  }

  /**
   * Nota de crédito real (a diferencia de voidSaleInternal, que es solo un
   * marcador interno): emite un SalesDocument nuevo tipo CREDIT_NOTE que
   * referencia al original, restaura stock, y -- si el refundMethod es CASH
   * y la sesión de caja original SIGUE ABIERTA -- descuenta el efectivo
   * esperado (si ya está cerrada, no se toca retroactivamente; ver README).
   */
  async createCreditNote(
    originalSaleId: string,
    refType: "ANULACION_TOTAL" | "DEVOLUCION_PARCIAL" | "CORRECCION_MONTO",
    lines: { variantId: string; quantity: number }[],
    refundMethod: "CASH" | "CARD" | "TRANSFER" | "CHECK" | "OTHER",
    performedBy: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const resource = await tx.salesDocument.findUniqueOrThrow({ where: { id: originalSaleId } });
      await tx.$queryRaw`SELECT id FROM cash_sessions WHERE id = ${resource.cashSessionId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM sales_documents WHERE id = ${originalSaleId} FOR UPDATE`;
      const original = await tx.salesDocument.findUniqueOrThrow({ where: { id: originalSaleId } });
      if (original.status !== "ISSUED" || original.docType === 'CREDIT_NOTE') {
        throw new SaleConflictError("Solo se puede emitir una nota de crédito sobre un documento ISSUED");
      }

      const originalLines = await tx.salesLine.findMany({ where: { salesDocumentId: originalSaleId } });
      const originalByVariant = new Map(originalLines.map((l) => [l.variantId, l]));
      if (new Set(lines.map(l => l.variantId)).size !== lines.length) throw new SaleConflictError('No repitas una variante en la devolución');
      const references = await tx.salesDocumentReference.findMany({ where: { originalDocumentId: originalSaleId } });
      const credited = await tx.salesLine.findMany({ where: { salesDocumentId: { in: references.map(r => r.creditNoteId) } } });

      let creditTotal = 0;
      const inventoryLines = [];
      const creditLinesData: { variantId: string; variantGroupId: string; quantity: number; unitPrice: number; priceSource: "NORMAL" | "WHOLESALE" | "MANUAL"; subtotal: number }[] = [];

      for (const line of lines) {
        const originalLine = originalByVariant.get(line.variantId);
        if (!originalLine) throw new SaleConflictError(`La variante ${line.variantId} no está en la venta original`);
        const alreadyCredited = credited.filter(l => l.variantId === line.variantId).reduce((s, l) => s + Number(l.quantity), 0);
        if (line.quantity + alreadyCredited > Number(originalLine.quantity)) {
          throw new SaleConflictError(`No se puede acreditar más cantidad de la vendida para ${line.variantId}`);
        }
        const unitPrice = Number(originalLine.unitPrice);
        const subtotal = Math.round(unitPrice * line.quantity);
        creditTotal += subtotal;
        creditLinesData.push({
          variantId: line.variantId, variantGroupId: originalLine.variantGroupId, quantity: line.quantity,
          unitPrice, priceSource: originalLine.priceSource, subtotal,
        });

        // Restaura stock -- increment atómico, mismo criterio que voidSaleInternal.
        const restored = await tx.stock.upsert({
          where: { branchId_variantId: { branchId: original.branchId, variantId: line.variantId } },
          create: { branchId: original.branchId, variantId: line.variantId, quantity: line.quantity },
          update: { quantity: { increment: line.quantity } },
        });
        inventoryLines.push({ variantId: line.variantId, quantity: line.quantity, previousStock: Number(restored.quantity) - line.quantity, newStock: Number(restored.quantity) });
      }

      const netSubtotal = Math.round(creditTotal / (1 + IVA_RATE));
      const tax = creditTotal - netSubtotal;

      const creditNote = await tx.salesDocument.create({
        data: {
          branchId: original.branchId, cashSessionId: original.cashSessionId, customerId: original.customerId,
          docType: "CREDIT_NOTE", status: "PENDING_ISSUE", subtotal: netSubtotal, tax, total: creditTotal,
          createdBy: performedBy,
          lines: { create: creditLinesData },
          payments: { create: [{ cashSessionId: original.cashSessionId, method: refundMethod, amount: creditTotal }] },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          branchId: original.branchId, type: "RETURN", referenceId: creditNote.id, referenceType: "SalesDocument",
          notes: `Nota de crédito (${refType}) sobre venta ${originalSaleId}`, createdBy: performedBy,
          lines: { create: inventoryLines },
        },
      });

      // Solo se ajusta el efectivo esperado si la sesión original sigue
      // abierta -- si ya se cerró, no se puede reabrir su arqueo retroactivamente.
      if (refundMethod === "CASH") {
        const originalSession = await tx.cashSession.findUnique({ where: { id: original.cashSessionId } });
        if (originalSession?.status === "OPEN") {
          await tx.cashSession.update({ where: { id: original.cashSessionId }, data: { expectedCash: { decrement: creditTotal } } });
        }
      }

      const counter = await tx.docFolioCounter.upsert({
        where: { branchId_docType: { branchId: original.branchId, docType: "CREDIT_NOTE" } },
        create: { branchId: original.branchId, docType: "CREDIT_NOTE", lastFolio: 1 },
        update: { lastFolio: { increment: 1 } },
      });
      const folio = String(counter.lastFolio);

      const [updatedCreditNote, dte] = await Promise.all([
        tx.salesDocument.update({ where: { id: creditNote.id }, data: { status: "ISSUED", folio } }),
        tx.dTERequest.create({ data: { salesDocumentId: creditNote.id, status: "ACCEPTED", providerName: "INTERNAL_STUB", folio } }),
      ]);

      await tx.salesDocumentReference.create({
        data: { creditNoteId: creditNote.id, originalDocumentId: originalSaleId, refType },
      });

      await AuditService.log(tx, {
        userId: performedBy, action: "CREATE_CREDIT_NOTE", entityType: "SalesDocument", entityId: originalSaleId,
        beforeData: { status: original.status }, afterData: { creditNoteId: creditNote.id, refType, creditTotal },
      });

      return { document: toSalesDocumentDTO(updatedCreditNote), dteRequest: toDteDTO(dte) };
    });
  }

  /**
   * STUB: como nunca hay un envío real al SII, un DTERequest solo puede
   * llegar a REJECTED si alguien lo fuerza manualmente (ej. vía Prisma
   * Studio, para probar este flujo). Reintentar simplemente lo vuelve a
   * marcar como aceptado.
   */
  async retryDTE(dteRequestId: string) {
    const dte = await this.prisma.dTERequest.findUniqueOrThrow({ where: { id: dteRequestId } });
    if (dte.status !== "REJECTED") {
      throw new SaleConflictError("Solo se puede reintentar un DTE en estado REJECTED");
    }
    const updated = await this.prisma.dTERequest.update({
      where: { id: dteRequestId },
      data: { status: "ACCEPTED", lastError: null },
    });
    return toDteDTO(updated);
  }
}
