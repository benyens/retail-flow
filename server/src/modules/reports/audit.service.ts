import type { PrismaClient, Prisma } from "@prisma/client";

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Registra una acción sensible. Se llama explícitamente desde los pocos
   * puntos del sistema que hoy justifican trazabilidad (anular venta, nota
   * de crédito, cambio de rol de usuario) -- no es un hook automático de
   * toda mutación. Se puede llamar con `tx` (dentro de una transacción) o
   * sin él.
   */
  static async log(
    client: PrismaClient | Prisma.TransactionClient,
    params: {
      userId: string;
      action: string;
      entityType: string;
      entityId: string;
      beforeData?: unknown;
      afterData?: unknown;
    },
  ) {
    await client.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        beforeData: params.beforeData as Prisma.InputJsonValue,
        afterData: params.afterData as Prisma.InputJsonValue,
      },
    });
  }

  async getAuditLogs(entityType?: string, entityId?: string, filters: { action?: string; userId?: string; from?: string; to?: string; offset?: number } = {}) {
    const logs = await this.prisma.auditLog.findMany({
      where: { entityType, entityId, action: filters.action, userId: filters.userId,
        createdAt: { gte: filters.from ? new Date(filters.from) : undefined, lte: filters.to ? new Date(filters.to) : undefined } },
      orderBy: [{ createdAt: "desc" }, { id: 'desc' }],
      take: 100,
      skip: filters.offset ?? 0,
    });
    return logs.map((l) => ({
      id: l.id,
      userId: l.userId,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      beforeData: (l.beforeData as Record<string, unknown> | null) ?? undefined,
      afterData: (l.afterData as Record<string, unknown> | null) ?? undefined,
      createdAt: l.createdAt.toISOString(),
    }));
  }
}
