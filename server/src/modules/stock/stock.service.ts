import { AuditService } from "../reports/audit.service.js";
import type { PrismaClient } from "@prisma/client";

export class StockService {
  constructor(private readonly prisma: PrismaClient) {}

  async getStock(branchId: string) {
    const stocks = await this.prisma.stock.findMany({ where: { branchId } });
    return stocks.map((s) => ({ branchId: s.branchId, variantId: s.variantId, quantity: Number(s.quantity), lastUpdated: s.lastUpdated.toISOString() }));
  }

  async getStockByVariant(variantId: string, branchIds: string[]) {
    const stocks = await this.prisma.stock.findMany({ where: { variantId, branchId: { in: branchIds } }, include: { branch: true } });
    return stocks.map((s) => ({ branchId: s.branchId, branchName: s.branch.name, quantity: Number(s.quantity) }));
  }

  async getInventoryMovements(branchId: string) {
    const movements = await this.prisma.inventoryMovement.findMany({ where: { branchId }, orderBy: { createdAt: "desc" } });
    return movements.map((m) => ({
      id: m.id, branchId: m.branchId, type: m.type,
      referenceId: m.referenceId ?? undefined, referenceType: m.referenceType ?? undefined,
      notes: m.notes ?? undefined, createdAt: m.createdAt.toISOString(), createdBy: m.createdBy,
    }));
  }

  async getInventoryLines(movementId: string) {
    const lines = await this.prisma.inventoryLine.findMany({ where: { movementId } });
    return lines.map((l) => ({ id: l.id, movementId: l.movementId, variantId: l.variantId, quantity: Number(l.quantity), previousStock: Number(l.previousStock), newStock: Number(l.newStock) }));
  }

  async createAdjustment(branchId: string, variantId: string, quantity: number, notes: string, createdBy: string) {
    return this.prisma.$transaction(async (tx) => {

      // increment atómico -- ver README, sección de hardening.
      const updated = await tx.stock.upsert({
        where: { branchId_variantId: { branchId, variantId } },
        create: { branchId, variantId, quantity },
        update: { quantity: { increment: quantity } },
      });
      const newStock = Number(updated.quantity);
      const previousStock = newStock - quantity;

      const movement = await tx.inventoryMovement.create({
        data: {
          branchId, type: "ADJUSTMENT", notes, createdBy,
          lines: { create: [{ variantId, quantity, previousStock, newStock }] },
        },
      });

      await AuditService.log(tx, { userId: createdBy, action: "ADJUST_STOCK", entityType: "InventoryMovement", entityId: movement.id, beforeData: { quantity: previousStock }, afterData: { branchId, variantId, quantity: newStock, notes } });
      return {
        id: movement.id, branchId: movement.branchId, type: movement.type,
        referenceId: movement.referenceId ?? undefined, referenceType: movement.referenceType ?? undefined,
        notes: movement.notes ?? undefined, createdAt: movement.createdAt.toISOString(), createdBy: movement.createdBy,
      };
    });
  }
}
