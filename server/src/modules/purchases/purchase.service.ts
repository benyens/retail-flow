import { AuditService } from "../reports/audit.service.js";
import type { PrismaClient } from "@prisma/client";

export class PurchaseConflictError extends Error {
  readonly statusCode = 409;
}

const IVA_RATE = 0.19;

function toPurchaseInvoiceDTO(inv: {
  id: string; branchId: string; supplierId: string; invoiceNumber: string; invoiceDate: Date; notes: string | null;
  subtotal: unknown; tax: unknown; total: unknown; status: string; siiTrackId: string | null; lastError: string | null;
  createdAt: Date; createdBy: string; updatedAt: Date;
}) {
  return {
    id: inv.id, branchId: inv.branchId, supplierId: inv.supplierId, invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate.toISOString().slice(0, 10), notes: inv.notes ?? undefined,
    subtotal: Number(inv.subtotal), tax: Number(inv.tax), total: Number(inv.total), status: inv.status,
    siiTrackId: inv.siiTrackId ?? undefined, lastError: inv.lastError ?? undefined,
    createdAt: inv.createdAt.toISOString(), createdBy: inv.createdBy, updatedAt: inv.updatedAt.toISOString(),
  };
}

function toPurchaseLineDTO(l: { id: string; purchaseInvoiceId: string; variantId: string; quantity: unknown; unitCost: unknown; subtotal: unknown }) {
  return { id: l.id, purchaseInvoiceId: l.purchaseInvoiceId, variantId: l.variantId, quantity: Number(l.quantity), unitCost: Number(l.unitCost), subtotal: Number(l.subtotal) };
}

export class PurchaseService {
  constructor(private readonly prisma: PrismaClient) {}

  async listSuppliers() {
    return this.prisma.supplier.findMany({ orderBy: { name: "asc" } });
  }

  async createSupplier(input: { name: string; rut: string; email?: string; phone?: string; address?: string; isActive: boolean; businessLine?: string }) {
    return this.prisma.supplier.create({ data: input });
  }

  async updateSupplier(id: string, patch: Record<string, unknown>) {
    return this.prisma.supplier.update({ where: { id }, data: patch });
  }

  async listPurchases(branchId: string) {
    const invoices = await this.prisma.purchaseInvoice.findMany({ where: { branchId }, orderBy: { createdAt: "desc" } });
    return invoices.map(toPurchaseInvoiceDTO);
  }

  async createPurchase(
    branchId: string, supplierId: string, invoiceNumber: string, invoiceDate: string, notes: string,
    lines: { variantId: string; quantity: number; unitCost: number }[], createdBy: string,
  ) {
    const subtotal = Math.round(lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0));
    const tax = Math.round(subtotal * IVA_RATE);
    const total = subtotal + tax;

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.create({
        data: {
          branchId, supplierId, invoiceNumber, invoiceDate: new Date(invoiceDate), notes, subtotal, tax, total, createdBy,
          lines: { create: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost, subtotal: Math.round(l.quantity * l.unitCost) })) },
        },
      });

      const inventoryLines: { variantId: string; quantity: number; previousStock: number; newStock: number }[] = [];

      for (const line of lines) {

        // increment atómico -- ver README, sección de hardening.
        const updated = await tx.stock.upsert({
          where: { branchId_variantId: { branchId, variantId: line.variantId } },
          create: { branchId, variantId: line.variantId, quantity: line.quantity },
          update: { quantity: { increment: line.quantity } },
        });

        await tx.variant.update({ where: { id: line.variantId }, data: { lastPurchaseCost: line.unitCost, lastPurchaseDate: new Date() } });

        inventoryLines.push({ variantId: line.variantId, quantity: line.quantity, previousStock: Number(updated.quantity) - line.quantity, newStock: Number(updated.quantity) });
      }

      await tx.inventoryMovement.create({
        data: { branchId, type: "PURCHASE", referenceId: invoice.id, referenceType: "PurchaseInvoice", createdBy, lines: { create: inventoryLines } },
      });

      await AuditService.log(tx, { userId: createdBy, action: "CREATE_PURCHASE", entityType: "PurchaseInvoice", entityId: invoice.id, afterData: toPurchaseInvoiceDTO(invoice) });
      return toPurchaseInvoiceDTO(invoice);
    });
  }

  async updatePurchaseInvoice(id: string, patch: Record<string, unknown>, performedBy: string) {
    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM purchase_invoices WHERE id = ${id} FOR UPDATE`;
    const invoice = await tx.purchaseInvoice.findUniqueOrThrow({ where: { id } });
    if (invoice.status !== "DRAFT") throw new PurchaseConflictError("Solo se puede editar una factura en estado DRAFT");
    const data: Record<string, unknown> = {};
    if (patch.invoiceNumber !== undefined) data.invoiceNumber = patch.invoiceNumber;
    if (patch.invoiceDate !== undefined) data.invoiceDate = new Date(patch.invoiceDate as string);
    if (patch.notes !== undefined) data.notes = patch.notes;
    const updated = await tx.purchaseInvoice.update({ where: { id }, data });
    await AuditService.log(tx, { userId: performedBy, action: "UPDATE_PURCHASE", entityType: "PurchaseInvoice", entityId: id, beforeData: toPurchaseInvoiceDTO(invoice), afterData: toPurchaseInvoiceDTO(updated) });
    return toPurchaseInvoiceDTO(updated);
    });
  }

  async sendPurchaseInvoiceToSII(id: string, performedBy: string) {
    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM purchase_invoices WHERE id = ${id} FOR UPDATE`;
    const invoice = await tx.purchaseInvoice.findUniqueOrThrow({ where: { id } });
    if (invoice.status !== "DRAFT") throw new PurchaseConflictError("La factura ya fue enviada al SII");
    const updated = await tx.purchaseInvoice.update({
      where: { id }, data: { status: "SII_ACCEPTED", siiTrackId: `STUB-${crypto.randomUUID().slice(0, 12)}` },
    });
    await AuditService.log(tx, { userId: performedBy, action: "UPDATE_PURCHASE", entityType: "PurchaseInvoice", entityId: id, beforeData: toPurchaseInvoiceDTO(invoice), afterData: toPurchaseInvoiceDTO(updated) });
    return toPurchaseInvoiceDTO(updated);
    });
  }

  async getPurchaseLines(purchaseInvoiceId: string) {
    const lines = await this.prisma.purchaseLine.findMany({ where: { purchaseInvoiceId } });
    return lines.map(toPurchaseLineDTO);
  }
}
