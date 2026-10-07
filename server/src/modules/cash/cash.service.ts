import { AuditService } from "../reports/audit.service.js";
import type { PrismaClient } from "@prisma/client";

function toCashSessionDTO(s: {
  id: string; cashRegisterId: string; userId: string; openedAt: Date; closedAt: Date | null;
  initialFund: unknown; expectedCash: unknown; declaredCash: unknown; difference: unknown;
  status: string; closingNotes: string | null;
}) {
  return {
    id: s.id, cashRegisterId: s.cashRegisterId, userId: s.userId,
    openedAt: s.openedAt.toISOString(), closedAt: s.closedAt ? s.closedAt.toISOString() : undefined,
    initialFund: Number(s.initialFund), expectedCash: Number(s.expectedCash),
    declaredCash: s.declaredCash != null ? Number(s.declaredCash) : undefined,
    difference: s.difference != null ? Number(s.difference) : undefined,
    status: s.status, closingNotes: s.closingNotes ?? undefined,
  };
}

function toCashMovementDTO(m: {
  id: string; cashSessionId: string; type: string; concept: string; amount: unknown; reason: string;
  employeeId: string | null; authorizedBy: string | null; createdAt: Date;
}) {
  return {
    id: m.id, cashSessionId: m.cashSessionId, type: m.type, concept: m.concept, amount: Number(m.amount),
    reason: m.reason, employeeId: m.employeeId ?? undefined, authorizedBy: m.authorizedBy ?? undefined,
    createdAt: m.createdAt.toISOString(),
  };
}

const PAYMENT_METHODS = ["CASH", "CARD", "TRANSFER", "CHECK", "OTHER"] as const;
const DOC_TYPES = ["BOLETA", "FACTURA", "CREDIT_NOTE"] as const;

export class CashConflictError extends Error {
  readonly statusCode = 409;
}

export class CashService {
  constructor(private readonly prisma: PrismaClient) {}

  async openSession(cashRegisterId: string, userId: string, initialFund: number) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existingOpen = await tx.cashSession.findFirst({ where: { cashRegisterId, status: "OPEN" } });
          if (existingOpen) throw new CashConflictError("Ya existe una sesión de caja abierta para esta caja registradora");
          const session = await tx.cashSession.create({
            data: { cashRegisterId, userId, initialFund, expectedCash: initialFund, status: "OPEN" },
          });
          await AuditService.log(tx, { userId, action: "OPEN_CASH", entityType: "CashSession", entityId: session.id, afterData: toCashSessionDTO(session) });
          return toCashSessionDTO(session);
        },
        { isolationLevel: "Serializable" },
      );
    } catch (err) {
      if (err instanceof CashConflictError) throw err;
      const code = (err as { meta?: { code?: string } })?.meta?.code ?? (err as { code?: string })?.code;
      if (code === "40001" || code === "P2034") throw new CashConflictError("Ya existe una sesión de caja abierta para esta caja registradora");
      throw err;
    }
  }

  async getCurrentSession(cashRegisterId: string, userId?: string) {
    const session = await this.prisma.cashSession.findFirst({ where: { cashRegisterId, status: "OPEN", userId }, orderBy: { openedAt: "desc" } });
    return session ? toCashSessionDTO(session) : null;
  }

  async closeSession(sessionId: string, declaredCash: number, notes: string | undefined, performedBy: string) {
    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM cash_sessions WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.cashSession.findUniqueOrThrow({ where: { id: sessionId } });
    if (session.status !== "OPEN") throw new CashConflictError("La sesión ya está cerrada");
    const difference = Math.round(declaredCash - Number(session.expectedCash));
    const updated = await tx.cashSession.update({
      where: { id: sessionId },
      data: { status: "CLOSED", closedAt: new Date(), declaredCash, difference, closingNotes: notes },
    });
    await AuditService.log(tx, { userId: performedBy, action: "CLOSE_CASH", entityType: "CashSession", entityId: sessionId, beforeData: toCashSessionDTO(session), afterData: toCashSessionDTO(updated) });
    return toCashSessionDTO(updated);
    });
  }

  async getSessionSummary(sessionId: string) {
    const session = await this.prisma.cashSession.findUniqueOrThrow({ where: { id: sessionId } });
    const documents = await this.prisma.salesDocument.findMany({
      where: { cashSessionId: sessionId, status: "ISSUED" },
      include: { payments: true },
    });
    const movements = await this.prisma.cashMovement.findMany({ where: { cashSessionId: sessionId }, orderBy: { createdAt: "asc" } });

    const byPaymentMethod = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, 0])) as Record<string, number>;
    const byDocType = Object.fromEntries(DOC_TYPES.map((t) => [t, 0])) as Record<string, number>;

    let totalSales = 0;
    for (const doc of documents) {
      const sign = doc.docType === "CREDIT_NOTE" ? -1 : 1;
      totalSales += sign * Number(doc.total);
      byDocType[doc.docType] = (byDocType[doc.docType] ?? 0) + sign * Number(doc.total);
      for (const payment of doc.payments) {
        byPaymentMethod[payment.method] = (byPaymentMethod[payment.method] ?? 0) + sign * Number(payment.amount);
      }
    }

    return {
      session: toCashSessionDTO(session), totalSales, totalTransactions: documents.length, byPaymentMethod, byDocType,
      totalCashSales: byPaymentMethod.CASH ?? 0, totalCardSales: byPaymentMethod.CARD ?? 0,
      totalTransferSales: byPaymentMethod.TRANSFER ?? 0,
      totalOtherSales: (byPaymentMethod.CHECK ?? 0) + (byPaymentMethod.OTHER ?? 0),
      movements: movements.map(toCashMovementDTO), expectedCash: Number(session.expectedCash),
    };
  }

  async createMovement(sessionId: string, type: "IN" | "OUT", concept: string, amount: number, reason: string, authorizedBy: string, employeeId?: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM cash_sessions WHERE id = ${sessionId} FOR UPDATE`;
      const session = await tx.cashSession.findUniqueOrThrow({ where: { id: sessionId } });
      if (session.status !== "OPEN") throw new CashConflictError("La sesión de caja no está abierta");

      await tx.cashSession.update({
        where: { id: sessionId },
        data: { expectedCash: type === "IN" ? { increment: amount } : { decrement: amount } },
      });

      const movement = await tx.cashMovement.create({
        data: { cashSessionId: sessionId, type, concept: concept as never, amount, reason, employeeId, authorizedBy },
      });

      if ((concept === "ADVANCE_EMPLOYEE" || concept === "BONUS_AGUINALDO") && employeeId) {
        await tx.employeeAdvance.create({
          data: {
            employeeId, cashSessionId: sessionId, cashMovementId: movement.id,
            type: concept === "ADVANCE_EMPLOYEE" ? "ADVANCE" : "BONUS", amount, reason,
          },
        });
      }

      await AuditService.log(tx, { userId: authorizedBy, action: "CASH_MOVEMENT", entityType: "CashMovement", entityId: movement.id, afterData: toCashMovementDTO(movement) });
      return toCashMovementDTO(movement);
    });
  }

  async getSessionMovements(sessionId: string) {
    const movements = await this.prisma.cashMovement.findMany({ where: { cashSessionId: sessionId }, orderBy: { createdAt: "asc" } });
    return movements.map(toCashMovementDTO);
  }
}
